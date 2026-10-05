/* Suuraseikkailu content. Arabic Quran text (field "ar") verbatim from Tanzil (Uthmani): DO NOT EDIT "ar".
   lines[].audio = recitation/voice file, lines[].rec = id of an optional parent recording (Shahada only),
   lines[].tts = Arabic text for the device speech fallback, n = verse number (0 = no verse marker). */
const SUURA_DATA = {
 "sections": [
  {
   "id": "shahada",
   "name": "Shahada",
   "ar": "الشَّهَادَة",
   "sub": "Uskontunnustus",
   "acc": "Shahadan",
   "color": "#33C3D6",
   "quran": false,
   "lines": [
    {
     "ar": "أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا اللَّهُ",
     "tts": "أَشْهَدُ أَنْ لا إِلَهَ إِلَّا اللَّه",
     "tr": "Ash-hadu an laa ilaaha illallaah,",
     "fi": "Todistan, että ei ole muuta jumalaa kuin Allah.",
     "audio": "audio/shahada-1.mp3",
     "n": 0,
     "rec": "shahada-1"
    },
    {
     "ar": "وَأَشْهَدُ أَنَّ مُحَمَّدًا رَسُولُ اللَّهِ",
     "tts": "وَأَشْهَدُ أَنَّ مُحَمَّدًا رَسُولُ اللَّه",
     "tr": "wa ash-hadu anna Muhammadan rasuulullaah.",
     "fi": "Ja todistan, että Muhammad on Allahin lähettiläs.",
     "audio": "audio/shahada-2.mp3",
     "n": 0,
     "rec": "shahada-2"
    }
   ]
  },
  {
   "id": "fatiha",
   "name": "Al-Fatiha",
   "ar": "الفَاتِحَة",
   "sub": "Avaus",
   "acc": "Al-Fatihan",
   "color": "#9A7BFF",
   "quran": true,
   "lines": [
    {
     "ar": "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
     "tr": "Bismil-laahir-rahmaanir-rahiim",
     "fi": "Allahin, Armeliaan, Armahtavan nimeen.",
     "audio": "audio/001001.mp3",
     "n": 1
    },
    {
     "ar": "ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ",
     "tr": "Al-hamdu lil-laahi rabbil-‘aalamiin",
     "fi": "Kaikki kiitos kuuluu Allahille, maailmojen Herralle.",
     "audio": "audio/001002.mp3",
     "n": 2
    },
    {
     "ar": "ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
     "tr": "Ar-rahmaanir-rahiim",
     "fi": "Armeliaalle, Armahtavalle.",
     "audio": "audio/001003.mp3",
     "n": 3
    },
    {
     "ar": "مَٰلِكِ يَوْمِ ٱلدِّينِ",
     "tr": "Maaliki yawmid-diin",
     "fi": "Tuomiopäivän Valtiaalle.",
     "audio": "audio/001004.mp3",
     "n": 4
    },
    {
     "ar": "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ",
     "tr": "Iyyaaka na‘budu wa iyyaaka nasta‘iin",
     "fi": "Vain Sinua me palvelemme, ja vain Sinulta pyydämme apua.",
     "audio": "audio/001005.mp3",
     "n": 5
    },
    {
     "ar": "ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ",
     "tr": "Ihdinas-siraatal-mustaqiim",
     "fi": "Ohjaa meidät suoralle tielle.",
     "audio": "audio/001006.mp3",
     "n": 6
    },
    {
     "ar": "صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ",
     "tr": "Siraatal-ladhiina an‘amta ‘alayhim, ghayril-maghduubi ‘alayhim wa lad-daalliin",
     "fi": "Niiden tielle, joita olet siunannut, ei niiden, jotka ovat saaneet vihasi, eikä niiden, jotka ovat eksyneet.",
     "audio": "audio/001007.mp3",
     "n": 7
    }
   ]
  },
  {
   "id": "ikhlas",
   "name": "Al-Ikhlas",
   "ar": "الإِخْلَاص",
   "sub": "Puhdas usko",
   "acc": "Al-Ikhlasin",
   "color": "#FF8BC8",
   "quran": true,
   "lines": [
    {
     "ar": "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
     "tr": "Bismil-laahir-rahmaanir-rahiim",
     "fi": "Allahin, Armeliaan, Armahtavan nimeen.",
     "audio": "audio/001001.mp3",
     "n": 0
    },
    {
     "ar": "قُلْ هُوَ ٱللَّهُ أَحَدٌ",
     "tr": "Qul huwal-laahu ahad",
     "fi": "Sano: Hän on Allah, yksi ja ainoa.",
     "audio": "audio/112001.mp3",
     "n": 1
    },
    {
     "ar": "ٱللَّهُ ٱلصَّمَدُ",
     "tr": "Allaahus-samad",
     "fi": "Allah, jota kaikki tarvitsevat ja joka ei tarvitse ketään.",
     "audio": "audio/112002.mp3",
     "n": 2
    },
    {
     "ar": "لَمْ يَلِدْ وَلَمْ يُولَدْ",
     "tr": "Lam yalid wa lam yuulad",
     "fi": "Hänellä ei ole lapsia, eikä Hän ole kenenkään lapsi.",
     "audio": "audio/112003.mp3",
     "n": 3
    },
    {
     "ar": "وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ",
     "tr": "Wa lam yakul-lahuu kufuwan ahad",
     "fi": "Eikä kukaan ole Hänen kaltaisensa.",
     "audio": "audio/112004.mp3",
     "n": 4
    }
   ]
  },
  {
   "id": "kawthar",
   "name": "Al-Kawthar",
   "ar": "الكَوْثَر",
   "sub": "Runsaus",
   "acc": "Al-Kawtharin",
   "color": "#4A86FF",
   "quran": true,
   "lines": [
    {
     "ar": "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
     "tr": "Bismil-laahir-rahmaanir-rahiim",
     "fi": "Allahin, Armeliaan, Armahtavan nimeen.",
     "audio": "audio/001001.mp3",
     "n": 0
    },
    {
     "ar": "إِنَّآ أَعْطَيْنَٰكَ ٱلْكَوْثَرَ",
     "tr": "Innaa a‘taynaakal-kawthar",
     "fi": "Me olemme antaneet sinulle Kawtharin, runsaasti hyvää.",
     "audio": "audio/108001.mp3",
     "n": 1
    },
    {
     "ar": "فَصَلِّ لِرَبِّكَ وَٱنْحَرْ",
     "tr": "Fasalli li-rabbika wanhar",
     "fi": "Rukoile siis Herraasi ja uhraa.",
     "audio": "audio/108002.mp3",
     "n": 2
    },
    {
     "ar": "إِنَّ شَانِئَكَ هُوَ ٱلْأَبْتَرُ",
     "tr": "Inna shaani’aka huwal-abtar",
     "fi": "Se, joka sinua vihaa, jää itse vaille kaikkea hyvää.",
     "audio": "audio/108003.mp3",
     "n": 3
    }
   ]
  }
 ],
 "credits": [
  "Koraanin teksti: Tanzil Quran Text (Uthmani), © Tanzil Project, CC BY 3.0, tanzil.net. Tekstiä saa käyttää vain muuttamattomana.",
  "Resitaatio: Mishary Rashid Alafasy (murattal), Quran.com / quranicaudio.com; sana-ajat Quran.com (QDC).",
  "Shahada: oikean ihmisen ääni, SC Brotherhood & News Reports (YouTube: How to recite the Shahada of Islam).",
  "Suomenkieliset kehotteet: valmiiksi tehdyt puheäänitteet (Microsoft Edge -puheääni Noora). Vanhempi voi korvata ne ja Shahadan omalla äänellään asetuksissa.",
  "Sana kerrallaan -paloittelu: Mishary Alafasyn resitaatio, sana-ajat Quran.com (QDC).",
  "Fontit: Fredoka, Nunito ja Amiri Quran (SIL Open Font License 1.1)."
 ]
};

export default SUURA_DATA;
