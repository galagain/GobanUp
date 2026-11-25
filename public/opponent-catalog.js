'use strict';
// Initial difficulty order, based on profile ranks, KaTrain estimates and local search limits.
// Each opponent keeps its saved engine ID and its tile in the portrait atlas.
const OpponentCatalog=[
  ['Débutant', [
    ['easy',      'Mica', 0],
    ['normal',    'Piko', 1],
    ['human-15k', 'Noma', 2],
    ['rank18',    'Lilo', 3],
    ['human-10k', 'Sumi', 4],
    ['rank14',    'Tavi', 5]
  ]],
  ['Intermédiaire', [
    ['gnugo',     'Nagi', 6],
    ['rank10',    'Riku', 7],
    ['human-5k',  'Yuna', 8],
    ['rank6',     'Kumo', 9],
    ['fuego',     'Sora', 10],
    ['tenuki',    'Haku', 11]
  ]],
  ['Avancé', [
    ['local',     'Nori', 12],
    ['territory', 'Aki', 13],
    ['rank2',     'Kaï', 14],
    ['influence', 'Yori', 15],
    ['weighted',  'Maki', 16],
    ['human-1d',  'Sayo', 17]
  ]],
  ['Expert', [
    ['raylu',     'Tora', 18],
    ['rank-1',    'Arko', 19],
    ['elf-v1',    'Raïko', 20],
    ['katago',    'Tenro', 21]
  ]]
];
