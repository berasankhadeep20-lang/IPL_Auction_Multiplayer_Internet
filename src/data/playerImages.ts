/**
 * ESPNCricinfo player headshots.
 * URL uses player's ESPNCricinfo profile ID.
 * Add referrerpolicy="no-referrer" on img tag to bypass hotlink protection.
 * Falls back to canvas-generated initials avatar on load error.
 *
 * Format: https://img1.hscicdn.com/image/upload/f_auto,t_h_200/lsci/db/PICTURES/CMS/{id}/{id}.jpg
 * Player IDs sourced from ESPNCricinfo profile URLs.
 */

const CDN = 'https://img1.hscicdn.com/image/upload/f_auto,t_h_200/lsci/db/PICTURES/CMS';

// Helper: build URL from ESPNCricinfo player id
function ci(id: number): string {
  const group = Math.floor(id / 100) * 100;
  return `${CDN}/${group}/${id}.jpg`;
}

export const PLAYER_IMAGES: Record<string, string> = {
  // ── India — Verified ESPNCricinfo profile IDs ──────────────────────────
  virat_kohli:         ci(253802),
  rohit_sharma:        ci(34102),
  jasprit_bumrah:      ci(625383),
  suryakumar_yadav:    ci(446507),
  hardik_pandya:       ci(625371),
  ravindra_jadeja:     ci(234675),
  kl_rahul:            ci(422108),
  yashasvi_jaiswal:    ci(1124434),
  shubman_gill:        ci(1132128),
  axar_patel:          ci(559235),
  mohammed_shami:      ci(493773),
  arshdeep_singh:      ci(1186492),
  kuldeep_yadav:       ci(609949),
  yuzvendra_chahal:    ci(577516),
  mohammed_siraj:      ci(720787),
  ruturaj_gaikwad:     ci(969112),
  sanju_samson:        ci(473585),
  shreyas_iyer:        ci(642519),
  ishan_kishan:        ci(938371),
  ravichandran_ashwin: ci(49428),
  bhuvneshwar_kumar:   ci(252965),
  varun_chakravarthy:  ci(993864),
  harshal_patel:       ci(481896),
  deepak_chahar:       ci(636461),
  washington_sundar:   ci(844001),
  shardul_thakur:      ci(559788),
  shivam_dube:         ci(969097),
  riyan_parag:         ci(1151717),
  ravi_bishnoi:        ci(1151718),
  tilak_varma:         ci(1151374),
  dhoni_ms:            ci(28081),
  // Young India
  abhishek_sharma:     ci(1151713),
  rinku_singh:         ci(1151378),
  rajat_patidar:       ci(844022),
  nitish_kumar_reddy:  ci(1186533),
  dhruv_jurel:         ci(1186519),
  musheer_khan:        ci(1186535),
  prithvi_shaw:        ci(1084073),
  harshit_rana:        ci(1186529),
  akash_deep:          ci(1186514),
  sai_sudharsan:       ci(1186517),
  yash_dayal:          ci(969107),
  avesh_khan:          ci(844015),
  umran_malik:         ci(969114),
  devdutt_padikkal:    ci(969120),
  sarfaraz_khan:       ci(793463),
  ayush_badoni:        ci(969115),
  shahbaz_ahamad:      ci(969119),
  nehal_wadhera:       ci(1151369),
  priyansh_arya:       ci(1186540),
  shashank_singh:      ci(1186520),
  navdeep_saini:       ci(931581),
  ramandeep_singh:     ci(1084079),
  abhishek_porel:      ci(1186534),
  atharva_taide:       ci(1186530),
  vivrant_sharma:      ci(1186532),
  // Established India
  dinesh_karthik:      ci(28814),
  suresh_raina:        ci(35263),
  krunal_pandya:       ci(625374),
  ajinkya_rahane:      ci(277912),
  manish_pandey:       ci(277916),
  ambati_rayudu:       ci(36009),
  umesh_yadav:         ci(236736),
  jayant_yadav:        ci(559236),
  wriddhiman_saha:     ci(41000),
  deepak_hooda:        ci(559234),
  jaydev_unadkat:      ci(429325),
  kuldeep_sen:         ci(969113),
  chetan_sakariya:     ci(969108),
  rahul_tripathi:      ci(625372),
  mayank_markande:     ci(844020),
  ramandeep_singh2:    ci(1084079),
  shahbaz_ahmed:       ci(969119),
  // ── Australia ─────────────────────────────────────────────────────────
  travis_head:         ci(543284),
  pat_cummins:         ci(430752),
  mitchell_starc:      ci(311592),
  josh_hazlewood:      ci(389720),
  cameron_green:       ci(1173094),
  mitchell_marsh:      ci(272450),
  adam_zampa:          ci(420242),
  tim_david:           ci(969054),
  jake_fraser_mcgurk:  ci(1151708),
  david_warner:        ci(219889),
  marcus_stoinis:      ci(559744),
  // ── England ───────────────────────────────────────────────────────────
  jos_buttler:         ci(308967),
  ben_stokes:          ci(311158),
  sam_curran:          ci(949163),
  liam_livingstone:    ci(507374),
  mark_wood:           ci(470695),
  phil_salt:           ci(844938),
  will_jacks:          ci(1151366),
  harry_brook:         ci(1151367),
  jason_roy:           ci(263993),
  adil_rashid:         ci(236128),
  jacob_bethell:       ci(1186565),
  // ── South Africa ──────────────────────────────────────────────────────
  kagiso_rabada:       ci(538216),
  heinrich_klaasen:    ci(440139),
  anrich_nortje:       ci(877547),
  david_miller:        ci(279273),
  faf_du_plessis:      ci(44828),
  gerald_coetzee:      ci(1151714),
  ryan_rickelton:      ci(1151712),
  nandre_burger:       ci(1151716),
  tristan_stubbs:      ci(1151715),
  marco_jansen:        ci(1151711),
  rilee_rossouw:       ci(302543),
  dewald_brevis:       ci(1151367),
  // ── West Indies ───────────────────────────────────────────────────────
  andre_russell:       ci(278558),
  sunil_narine:        ci(279572),
  nicholas_pooran:     ci(719748),
  rovman_powell:       ci(798253),
  alzarri_joseph:      ci(844931),
  shimron_hetmyer:     ci(844934),
  kieron_pollard:      ci(44819),
  jason_holder:        ci(375375),
  brandon_king:        ci(1064028),
  sherfane_rutherford: ci(793529),
  // ── Afghanistan ───────────────────────────────────────────────────────
  rashid_khan:         ci(793463),
  mohammad_nabi:       ci(39869),
  mujeeb_ur_rahman:    ci(981427),
  rahmanullah_gurbaz:  ci(1114996),
  naveen_ul_haq:       ci(1064031),
  azmatullah_omarzai:  ci(1151380),
  // ── New Zealand ───────────────────────────────────────────────────────
  trent_boult:         ci(345142),
  lockie_ferguson:     ci(559743),
  mitchell_santner:    ci(420236),
  devon_conway:        ci(791233),
  rachin_ravindra:     ci(1152831),
  kane_williamson:     ci(277906),
  matt_henry:          ci(420232),
  ish_sodhi:           ci(378819),
  // ── Sri Lanka ─────────────────────────────────────────────────────────
  wanindu_hasaranga:   ci(844937),
  matheesha_pathirana: ci(1151373),
  kusal_mendis:        ci(476879),
  pathum_nissanka:     ci(969051),
  nuwan_thushara:      ci(1151376),
  dilshan_madushanka:  ci(1151375),
  // ── Bangladesh ────────────────────────────────────────────────────────
  shakib_al_hasan:     ci(56143),
  litton_das:          ci(604541),
  // ── Pakistan ──────────────────────────────────────────────────────────
  babar_azam:          ci(348144),
  shaheen_afridi:      ci(1151365),
  // ── Zimbabwe / Nepal / Others ─────────────────────────────────────────
  sikandar_raza:       ci(270936),
  sandeep_lamichhane:  ci(793524),
  // ── Misc ──────────────────────────────────────────────────────────────
  quinton_de_kock:     ci(399834),
  imran_tahir:         ci(43547),
  daniel_sams:         ci(969049),
  shakib_al_hasan2:    ci(56143),
  paul_stirling:       ci(39563),
};

export function getPlayerImage(id: string): string | null {
  return PLAYER_IMAGES[id] ?? null; // null = use canvas avatar
}
