var urlParams = new URLSearchParams(window.location.search);
var player

function doSearch() {
    var s = document.getElementById('searchText').value;
    window.location.href = '?search=' + btoa(s);
}

function buildToneRow(tones) {
    let rows = ''
    tones.forEach(function (value, index) {
        let search = urlParams.get('search') ?? ''
        let category = urlParams.get('category') ?? ''
        let artistUriEnc = encodeURIComponent(value.Artist)
        let row = `
        <tr>
            <td>
                <a href="?search=${artistUriEnc}">${value.Artist}</a>
            </td>
            <td>
                <a href="?toneid=${value.ToneId}&search=${search}&category=${category}">${value.Title}</a>
            </td>
            <td style='text-align:center'>
                ${parseInt(value.Counter).toLocaleString()}
            </td>
        </tr>
        `
        rows += row
    })
    return rows
}

function previewMidi(id) {
    let url = `/rts/midi/${id}`
    
    fetchMidi(url).then((response) => {
        let midi = response
        let smf = new JZZ.MIDI.SMF(midi);
        player.load(smf);
    })
}

function getTone(id) {
    let data = { }
    let url = `/rts/tones/${id}`
    query(url, 'GET', data).then((response) => {
        $('#detailTitle').text(`${response.Artist} - ${response.Title}`)
        $('#detailViews').text(`${parseInt(response.Counter).toLocaleString()}`)
        $('#detailDownload').html(`
            <form id="midiDownload" method="get" action="/rts/midi/${response.ToneId}">
                <a href="javascript:;" onclick="$('#midiDownload').submit()">MIDI</a>
            </form>
        `)
        $('#detailRtttl').text(response.Rtttl)
        document.title = `${document.title} (${response.Artist} - ${response.Title})`
        previewMidi(response.ToneId)
        $('#toneDetail').show()
    })
}

function getToneCount() {
    let data = { }
    let url = `/rts/tonecount`
    query(url, 'GET', data).then((response) => {
        $('#totalRingtones').text(`${parseInt(response.ToneCount).toLocaleString()}`)
    })
}

function getStats() {
    let data = { }
    let url = `/rts/stats`
    query(url, 'GET', data).then((response) => {
        response.forEach(function (value, index) {
            let name = value.StatName.toUpperCase()
            if (name == 'COUNTINGSINCE') {
                let options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
                let date = new Date(value.StatValue)
                $('#countingSince').text(date.toLocaleDateString("en-US", options))
            } else if (name == 'PAGEVIEWS') {
                $('#totalPageViews').text(parseInt(value.StatValue).toLocaleString())
            }
        })
    })
}

function getTones(category) {
    let data = { }
    let url = ''
    if (category == null || category == '') {
        url = '/rts/tones' 
    } else {
        url = `/rts/browse/${category}`
    }
    query(url, 'GET', data).then((response) => {
        $("#toneHead").after(buildToneRow(response))
        $("#toneCount").text(response.length)
        $('#toneListContainer').show()
    });
}

function searchTones(search) {
    let data = { }
    let url = `/rts/search/${search}`
    query(url, 'GET', data).then((response) => {
        $('#categoryTitle').text(`Search results: ${search}`)
        $("#toneHead").after(buildToneRow(response))
        $("#toneCount").text(response.length)
        $('#toneListContainer').show()
    });
}

function getCategoryInfo(category) {
    if (category == null || category == '') {
        $('#categoryTitle').text(`Top 20 ringtones`)
    } else {
        let data = { }
        query(`/rts/categories/${category}`, 'GET', data).then((response) => {
            $('#categoryTitle').text(`Category: ${response.CategoryName}`)
        });    
    }
}

function getCategories() {
    let data = { }
    query('/rts/categories', 'GET', data).then((response) => {
        let link = `<a class='categoryLink' href='.'>Top 20</a>`
        $("#categories").append(link)
        response.forEach(function (value, index) {
            let link = `<a class='categoryLink' href='?category=${value.CategoryCode}'>${value.CategoryName}</a>`
            $("#categories").append(link)
        })
        $('#categoryContainer').show()
    });
}

async function convertRtttlToMidi(rtttl) {
    $('#errorMessage').text('')
    if(rtttl == null || rtttl.trim() == '') {
        alert('You must have something in the RTTTL to convert!')
        return
    }
    let data = { rtttl: rtttl }
    let response = await fetch(
        '/rts/midi',
        {
            headers: {
                'Accept': "audio/midi, application/json, text/plain",
                'Content-Type': 'application/json'
            },
            method: 'POST',
            body: JSON.stringify(data),
        }
    )
    if (!response.ok) {
        let message = ""
        if (response.status == 418) {
            json = await response.json()
            message = json.error
        } else {
            message = "Unspecified conversion error"
        }
        $('#errorMessage').text(message)
        throw new Error("HTTP error converting RTTTL to MIDI: " + response.status)
    }
    let buffer = await response.arrayBuffer()
    let file = new File([buffer], 'converted.mid', { type: "application/x-msdownload" })
    let url = URL.createObjectURL(file)
    let link = document.createElement("a")
    link.href = url
    link.download = 'converted.mid'
    link.click()
    URL.revokeObjectURL(url)
}

async function fetchMidi(url) {
    let response = await fetch(url)
    if (!response.ok) {
        throw new Error("HTTP error " + response.status)
    }
    let buffer = await response.arrayBuffer()
    let binaryString = Array.from(new Uint8Array(buffer), byte => String.fromCharCode(byte)).join("")
    return binaryString
}

async function query(url, method, data) {
    let response;
    if (method == 'GET') {
        response = await fetch(
            url,
            {
                headers: {
                    'Accept': "audio/midi, application/json, text/plain",
                    'Content-Type': 'application/json'
                },
                method: method,
            }
        );    
    } else {
        response = await fetch(
            url,
            {
                headers: {
                    'Accept': "audio/midi, application/json, text/plain",
                    'Content-Type': 'application/json'
                },
                method: method,
                body: JSON.stringify(data),
            }
        );    
    }
    let result = await response.json()
    return result;
}

$(document).ready(function() {
    $('#searchText').focus()
    $('#searchText').keypress(function(e){
        if(e.keyCode==13)
        $('#searchButton').click()
    })

    getStats()
    getToneCount()
    getCategories()

    let category = urlParams.get('category')
    let search = urlParams.get('search')
    let convert = urlParams.get('convert')
    let toneId = urlParams.get('toneid')

    if (toneId != null && toneId != '') {
        getTone(toneId)
        JZZ.synth.Tiny.register('Web Audio');
        player = new JZZ.gui.Player({at: 'player', midi: false, file: false });    
    }

    if (convert != null && convert != '') {
        $('#convertContainer').show()
        let defaultRtttl = "TocattaFugue:d=32,o=5,b=100:a#.,g#.,2a#,g#,f#,f,d#.,4d.,2d#,a#.,g#.,2a#,8f,8f#,8d,2d#,8d,8f,8g#,8b,8d6,4f6,4g#.,4f.,1g,32p"
        $('#rtttlText').val(defaultRtttl)
    } else if (category != null && category != '') {
        getCategoryInfo(category)
        getTones(category)    
    } else if (search != null && search != '') {
        search = atob(search)
        if (search.length < 3) {
            $('#searchText').val(search)
            alert('Search term must be at least 3 characters')
        } else {
            searchTones(search)
        }
    } else {
        getCategoryInfo()
        getTones() 
    }
});