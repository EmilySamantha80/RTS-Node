const urlParams = new URLSearchParams(window.location.search)
const useSoundFont = false
const soundFontInstrument = 'acoustic_grand_piano'

function doSearch() {
    var s = document.getElementById('searchText').value
    window.location.href = '?search=' + btoa(s)
}

function buildToneRow(tones) {
    let rows = ''
    tones.forEach(function (value, index) {
        let search = urlParams.get('search') ?? ''
        let category = urlParams.get('category') ?? ''
        let row = `
        <tr>
            <td>
                <a href="?search=${btoa(value.Artist)}">${value.Artist}</a>
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

async function previewMidi(id) {
    let url = `/rts/midi/${id}`
    
    try {
        let response = await fetchMidi(url)
        let midi = response
        let smf = new JZZ.MIDI.SMF(midi)
        var player = new JZZ.gui.Player({at: 'player', midi: false, file: true })
        if (useSoundFont == true) {
            JZZ.synth.MIDIjs.register({ soundfontUrl: "./JZZ/soundfont/", instrument: soundFontInstrument })
        } else {
            JZZ.synth.Tiny.register('Web Audio')
        }
        player.onPlay = function() {
            $('#playerStatus').show()
        }
        player.onSelect = function () {
            $('#playerStatus').hide()
            player.onPlay = function() {}
            player.onSelect = function() {}
        }
        player.load(smf)
    } catch {

    }
}

async function getTone(id) {
    let data = { }
    let url = `/rts/tones/${id}`
    let response = await query(url, 'GET', data)
    // console.log(response)
    $('#detailTitle').text(`${response.Artist} - ${response.Title}`)
    $('#detailViews').text(`${parseInt(response.Counter).toLocaleString()}`)
    $('#detailDownload').html(`
        <form id="midiDownload" method="get" action="/rts/midi/${response.ToneId}">
            <a href="javascript:;" onclick="$('#midiDownload').submit()">MIDI</a>
        </form>
    `)
    $('#detailRtttl').text(response.Rtttl)
    document.title = `${response.Artist} - ${response.Title}`
    await previewMidi(response.ToneId)
    $('#toneDetail').show()
}

async function getToneCount() {
    let data = { }
    let url = `/rts/tonecount`
    let response = await query(url, 'GET', data)
    $('#totalRingtones').text(`${parseInt(response.ToneCount).toLocaleString()}`)
}

async function getStats() {
    let data = { }
    let url = `/rts/stats`
    let response = await query(url, 'GET', data)
    response.forEach(function (value, index) {
        let name = value.StatName.toUpperCase()
        if (name == 'COUNTINGSINCE') {
            let options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
            let date = new Date(value.StatValue)
            $('#countingSince').text(date.toLocaleDateString("en-US", options))
        } else if (name == 'PAGEVIEWS') {
            $('#totalPageViews').text(parseInt(value.StatValue).toLocaleString())
        }
    })
}

async function getTones(category) {
    let data = { }
    let url = ''
    if (category == null || category == '') {
        url = '/rts/tones' 
    } else {
        url = `/rts/browse/${category}`
    }
    let response = await query(url, 'GET', data)
    $("#toneHead").after(buildToneRow(response))
    $("#toneCount").text(response.length)
    $('#toneListContainer').show()
}

async function searchTones(search) {
    let data = { }
    let url = `/rts/search/${search}`
    let response = await query(url, 'GET', data)
    $('#categoryTitle').text(`Search results: ${search}`)
    $("#toneHead").after(buildToneRow(response))
    $("#toneCount").text(response.length)
    $('#toneListContainer').show()
}

async function getCategoryInfo(category) {
    if (category == null || category == '') {
        $('#categoryTitle').text(`Top 20 ringtones`)
        document.title = `Top 20 ringtones`
    } else {
        let data = { }
        response = await query(`/rts/categories/${category}`, 'GET', data)
        $('#categoryTitle').text(`Category: ${response.CategoryName}`)
        document.title = `${response.CategoryName} ringtones`
    }
}

async function getCategories() {
    let data = { }
    let response = await query('/rts/categories', 'GET', data)
    let link = `<a class='categoryLink' href='.'>Top 20</a>`
    $("#categories").append(link)
    response.forEach(function (value, index) {
        let link = `&nbsp;<a class='categoryLink' href='?category=${value.CategoryCode}'>${value.CategoryName}</a>`
        $("#categories").append(link)
    })
    $('#categoryContainer').show()
}

async function convertRtttlToMidi(rtttl) {
    $('#convertResults').hide()
    $('#convertDownload').html('')

    $('#errorDiv').hide()
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
        $('#errorDiv').show()
        $('#errorMessage').text(message)
        throw new Error("HTTP error converting RTTTL to MIDI: " + response.status)
    }
    let convertedMidiBuffer = await response.arrayBuffer()
    let filename = `${rtttl.substring(0, rtttl.indexOf(":"))}.mid`
    let file = new File([convertedMidiBuffer], filename, { type: "application/x-msdownload" })
    let url = URL.createObjectURL(file)
    let link = document.createElement("a")
    link.href = url
    link.download = filename
    link.text = 'MIDI'
    $('#convertDownload').append(link)

    $("#convertPlayer").empty()
    let convertedMidi = Array.from(new Uint8Array(convertedMidiBuffer), byte => String.fromCharCode(byte)).join("")
    let smf = new JZZ.MIDI.SMF(convertedMidi)
    var player = new JZZ.gui.Player({at: 'convertPlayer', midi: false, file: true })
    if (useSoundFont == true) {
        JZZ.synth.MIDIjs.register({ soundfontUrl: "./JZZ/soundfont/", instrument: soundFontInstrument })
    } else {
        JZZ.synth.Tiny.register('Web Audio')
    }
    player.onPlay = function() {
        $('#convertPlayerStatus').show()
    }
    player.onSelect = function () {
        $('#convertPlayerStatus').hide()
        player.onPlay = function() {}
        player.onSelect = function() {}
    }
    player.load(smf)

    $('#convertResults').show()

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
    let response
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
        )    
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
        )    
    }
    let result = await response.json()
    return result
}

async function setUpPage() {
    getStats()
    getToneCount()
    getCategories()

    let category = urlParams.get('category')
    let search = urlParams.get('search')
    let convert = urlParams.get('convert')
    let toneId = urlParams.get('toneid')

    if (convert != null && convert != '') {
        $('#convertContainer').show()
        let defaultRtttl = "TocattaFugue:d=32,o=5,b=100:a#.,g#.,2a#,g#,f#,f,d#.,4d.,2d#,a#.,g#.,2a#,8f,8f#,8d,2d#,8d,8f,8g#,8b,8d6,4f6,4g#.,4f.,1g,32p"
        $('#rtttlText').val(defaultRtttl)
        let hidePlayer=function(e){player.stop();$('#convertResults').hide();$('#errorDiv').hide();}
        $('#rtttlText').on('keydown', hidePlayer)
        $('#rtttlText').on('paste', hidePlayer)
        $('#rtttlText').on('cut', hidePlayer)
    } else if (category != null && category != '') {
        getCategoryInfo(category)
        await getTones(category)    
    } else if (search != null && search != '') {
        search = atob(search)
        if (search.length < 3) {
            $('#searchText').val(search)
            alert('Search term must be at least 3 characters')
        } else {
            await searchTones(search)
        }
    } else {
        getCategoryInfo()
        await getTones() 
    }

    if (toneId != null && toneId != '') {
        await getTone(toneId)
    }
}

$(document).ready(function() {
    $('#searchText').focus()
    $('#searchText').keypress(function(e){
        if(e.keyCode==13)
        $('#searchButton').click()
    })

    setUpPage().then(() => {
       $("#spinnerContainer").hide()
    })
})