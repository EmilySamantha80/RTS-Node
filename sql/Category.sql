-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: May 24, 2024 at 05:21 PM
-- Server version: 10.6.17-MariaDB-cll-lve
-- PHP Version: 8.1.27

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `betatrzl_rts`
--

-- --------------------------------------------------------

--
-- Table structure for table `Category`
--

CREATE TABLE `Category` (
  `CategoryCode` varchar(50) NOT NULL,
  `CategoryName` varchar(50) NOT NULL,
  `SortId` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `Category`
--

INSERT INTO `Category` (`CategoryCode`, `CategoryName`, `SortId`) VALUES
('80s', '80\'s', 10),
('Anthems', 'Anthems', 20),
('Christmas', 'Christmas', 30),
('Classical', 'Classical', 40),
('Country', 'Country', 50),
('Dance', 'Dance', 60),
('Disney', 'Disney', 70),
('Holiday', 'Holiday', 80),
('Latin', 'Latin', 90),
('Movie', 'Movie', 110),
('Musical', 'Musicals', 120),
('Oldies', 'Oldies', 100),
('Other', 'Other', 230),
('Pop', 'Pop', 130),
('Rap', 'Rap', 140),
('RB', 'R&B', 150),
('Rock', 'Rock', 160),
('Swing', 'Swing', 170),
('Techno', 'Techno', 180),
('Theme', 'Themes', 190),
('Traditional', 'Traditional', 200),
('TV', 'TV', 210),
('VG', 'Video Game', 220);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `Category`
--
ALTER TABLE `Category`
  ADD PRIMARY KEY (`CategoryCode`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
