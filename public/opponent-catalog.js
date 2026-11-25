'use strict';
const OpponentCatalog=(()=>{
  // OGS account IDs are stable. Ranks are indicative snapshots of the accounts.
  const groups=[
    ['Débutant', [
      [1195515, 'Agapanthus', '25k'],
      [1200334, 'Amaranthus', '25k'],
      [1958351, 'Oroton Parrot', '25k'],
      [1907021, 'Oroton Koala', '25k'],
      [605979, 'amybot-beginner', '25k'],
      [1904320, 'Oroton Tiger', '25k'],
      [1893795, 'Oroton', '25k'],
      [1195517, 'Bergamot', '23k'],
      [2143892, 'leonbot1', '23k'],
      [2028892, '15k-kgs-humanlike-kata', '21k', 'human-15k'],
    ]],
    ['Moyen', [
      [1278465, 'Bouvardia', '19k'],
      [608184, 'amybot-ddk', '15k'],
      [58441, 'GnuGo', '13k', 'gnugo'],
      [1549392, 'DangoApp_bot_3', '13k'],
      [1195518, 'Carnation', '10k'],
      [608188, 'amybot-sdk', '7k'],
      [2028889, '10k-kgs-humanlike-kata', '16k', 'human-10k'],
      [2122166, 'ZX Spectrum 48K', '12k'],
      [2025391, '5k-kgs-humanlike-kata', '8k', 'human-5k'],
    ]],
    ['Avancé', [
      [58542, 'Fuego', '5k', 'fuego'],
      [1195519, 'Deutzia', '4k'],
      [1543537, 'DangoApp_bot_2', '3k'],
      [1195520, 'Echinops', '2k'],
      [2132717, 'monumosa', '2k'],
      [2043688, 'bot37', '3d'],
      [2123396, 'ZX Spectrum 128K', '5k'],
      [743279, '12bTurboSai', '1k'],
      [811208, 'raylubot', '1k', 'raylu'],
      [2028891, '1d-kgs-humanlike-kata', '1k', 'human-1d'],
      [1766503, 'drunken master bot', '2d'],
      [2114500, 'go-rs', '3d'],
      [2132317, 'AuroraGo-8d', '3d'],
      [625990, '20bTurboLz-Elf-v1', '3d'],
      [602660, '15bTurboLeela', '4d'],
      [902691, 'katago-micro', '9d'],
      [2007355, 'cEmbryo', '9d'],
    ]]
  ].map(([label,rows])=>[label,rows.map(([id,name,rank,engine])=>({
    name,rank,engine,key:engine||'ogs-'+id,url:'https://online-go.com/player/'+id
  }))]);
  const byKey=new Map(groups.flatMap(([,rows])=>rows.map(entry=>[entry.key,entry])));
  return {groups,get:key=>byKey.get(key)};
})();
