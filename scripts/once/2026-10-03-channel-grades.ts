// 채널 등급 초안 — content/channels.yaml + docs/drafts/channel-grades-draft.csv (2026-10-03)
// 수업나래 실생활 맥락 탐구자료 계획 §2 K2. 이름 규칙 + 손 분류. 운영자 검수 뒤 yaml이 정본이 된다.
// 등급: public(공공기관·공공연구·지자체) · edu(교육청·교육연구기관·EBS) · press(언론·방송) · personal(개인·기업·단체)
import fs from "node:fs";
import path from "node:path";

type Kind = string;
const GRADE: Record<Kind, string> = {
  "정부·공공기관": "public", "지자체": "public", "국립 박물관·과학관": "public", "공공 연구기관": "public",
  "교육청·교육연구기관": "edu", "EBS": "edu",
  "언론(뉴스)": "press", "방송(교양·다큐)": "press", "방송(예능)": "press",
  "대학·병원": "public",
  "교육 기업·출판사": "personal", "기업": "personal", "단체": "personal", "개인": "personal",
};

// 손 분류 — 이름만으로는 갈리지 않거나 규칙이 틀리게 잡는 채널. [세부, 확인 필요, 메모]
const MANUAL: Record<string, [Kind, boolean?, string?]> = {
  "교양 Voyage": ["개인", false, "이름에 '교양'이 있지만 방송사 채널 아님"],
  "KTV 정책 K": ["정부·공공기관", false, "국민방송(정부)"], "KTV 국민방송": ["정부·공공기관"], "KTV  다큐": ["정부·공공기관"], "KTV 아카이브": ["정부·공공기관"],
  "KFN": ["정부·공공기관", false, "국군방송"],
  "내셔널지오그래픽 - National Geographic Korea": ["방송(교양·다큐)"],
  "사피엔스 스튜디오": ["방송(교양·다큐)", false, "CJ ENM(tvN) 교양"],
  "디글 :Diggle": ["방송(예능)", true, "tvN 예능 클립"],
  "크랩 KLAB": ["언론(뉴스)", false, "KBS"], "스브스뉴스 SUBUSUNEWS": ["언론(뉴스)", false, "SBS"],
  "비디오머그 - VIDEOMUG": ["언론(뉴스)", false, "SBS"], "엠빅뉴스": ["언론(뉴스)", false, "MBC"], "14F 일사에프": ["언론(뉴스)", false, "MBC"],
  "씨리얼": ["언론(뉴스)", false, "CBS"], "취재대행소 왱": ["언론(뉴스)", false, "한국일보"], "뉴스타파 Newstapa": ["언론(뉴스)"],
  "달리 [SBS DALI] - SBS 공식 교양 채널": ["방송(교양·다큐)"], "옛날티비 : KBS Archive": ["방송(교양·다큐)"],
  "ch B tv 대구": ["언론(뉴스)", false, "SK브로드밴드 지역 채널"], "ch B tv 중부": ["언론(뉴스)", false, "SK브로드밴드 지역 채널"],
  "LG헬로비전 대구경북": ["언론(뉴스)", false, "지역 케이블"], "푸른방송뉴스채널": ["언론(뉴스)", false, "대구 지역 케이블"],
  "NIB남인천방송": ["언론(뉴스)", false, "지역 케이블"], "법률방송": ["언론(뉴스)"], "TBS 시민의방송": ["언론(뉴스)"],
  "G1 News": ["언론(뉴스)", false, "강원민방"], "UBC 뉴스": ["언론(뉴스)", false, "울산방송"], "KNN NEWS": ["언론(뉴스)", false, "부산경남방송"],
  "TJB NEWS": ["언론(뉴스)", false, "대전방송"], "TBC뉴스": ["언론(뉴스)", false, "대구방송"], "OBS뉴스": ["언론(뉴스)"], "OBS TV": ["방송(교양·다큐)"],
  "dgmbcnews": ["언론(뉴스)", false, "대구MBC"], "대구MBC Program": ["방송(교양·다큐)", false, "대구MBC"],
  "제민일보": ["언론(뉴스)"], "매일신문": ["언론(뉴스)"], "국민일보": ["언론(뉴스)"], "디지틀조선일보": ["언론(뉴스)"], "경북일보TV": ["언론(뉴스)"], "영남일보TV": ["언론(뉴스)"],
  "TVCHOSUN - TV조선": ["언론(뉴스)"], "play 채널A": ["방송(예능)", true], "채널아하: 채널A Health & Asset": ["방송(교양·다큐)", true, "채널A 건강·재테크"],
  "환경스페셜": ["방송(교양·다큐)", true, "KBS 프로그램 이름 — 공식 채널인지 확인"],
  "KBS 생로병사의 비밀": ["방송(교양·다큐)"], "KBS 트래블-걸어서 세계속으로": ["방송(교양·다큐)"],
  "캔디 KANDY_KBS제주": ["방송(교양·다큐)", true, "KBS제주"],
  "SBS 공식 키즈 콘텐츠 '꾸러기탐구생활": ["방송(교양·다큐)"], "SBS TV동물농장x애니멀봐": ["방송(교양·다큐)"],
  "KBS동물티비 : 애니멀포유 animal4u": ["방송(교양·다큐)"], "KBSKids": ["방송(교양·다큐)"],
  "엠뚜루마뚜루 : MBC 공식 종합 채널": ["방송(예능)", true], "MBC PLAYGROUND": ["방송(예능)", true], "MBClife": ["방송(예능)", true],
  "런닝맨 - 스브스 공식 채널": ["방송(예능)", true], "유 퀴즈 온 더 튜브": ["방송(예능)", true, "tvN"],
  "YTN star": ["방송(예능)", true], "YTN 밀덕스": ["언론(뉴스)", true, "YTN 군사 채널"],
  "BBC News 코리아": ["언론(뉴스)"], "뉴스1TV": ["언론(뉴스)"], "다경뉴스TV": ["개인", true, "이름에 '뉴스' — 언론사 확인 못함"],
  "뉴스쿨TV by News'Cool": ["개인", true, "이름에 '뉴스' — 언론사 확인 못함"],
  "K-팩트체커": ["개인", true, "팩트체크 채널 — 운영 주체 확인"],
  "Korea UHD Showcase": ["개인", true, "운영 주체 확인"],
  "대구는 요즘 어때?": ["개인", true, "운영 주체 확인(대구시 채널일 수 있음)"], "대구가이드": ["개인", true],
  "달성사이다 : 대구광역시 달성군": ["지자체"], "수성TV At Suseong": ["지자체", false, "대구 수성구"],
  "대구 서구 TV": ["지자체"], "대구 동구청 팔공TV": ["지자체"], "대구광역시 북구": ["지자체"],
  "대구TV┃대구광역시 공식 유튜브": ["지자체"], "대구관광 공식 유튜브 | 비짓대구": ["지자체"],
  "화성특례시 · 화성온TV": ["지자체"], "세종특별자치시": ["지자체"], "Gongju흥미진진 공주시": ["지자체"], "충청북도": ["지자체"], "강남구": ["지자체"],
  "시흥자치TV": ["지자체", true], "한강공원": ["지자체", false, "서울시"], "경기도 업사이클플라자": ["지자체", true, "경기도 시설"],
  "청도프로방스빛축제": ["기업"], "경주월드(Gyeongju World)": ["기업"], "백제문화단지": ["정부·공공기관", true, "충남 운영 시설"],
  "국가지질공원": ["정부·공공기관"], "국립공원TV": ["정부·공공기관"], "국가유산채널(K-Heritage Channel)": ["정부·공공기관"],
  "문화포털": ["정부·공공기관", false, "문체부"], "kculturechannel": ["정부·공공기관", true, "운영 주체 확인"], "K-VIBE": ["개인", true, "운영 주체 확인"],
  "VISITKOREA": ["정부·공공기관", false, "한국관광공사"], "한국관광공사TV": ["정부·공공기관"],
  "안전한TV": ["정부·공공기관", false, "행정안전부"], "통일부UNITV": ["정부·공공기관"], "국회 유튜브": ["정부·공공기관"],
  "대한민국 대법원": ["정부·공공기관"], "법원도서관": ["정부·공공기관"], "저작권TV": ["정부·공공기관", false, "한국저작권위원회"],
  "IP STORY CENTER": ["정부·공공기관", true, "특허청 계열로 보임"], "경제배움e+": ["정부·공공기관", true, "기획재정부 경제교육 채널로 보임"],
  "생물누리TV": ["정부·공공기관", true, "국립생물자원관 계열로 보임"], "nsmscience": ["국립 박물관·과학관", true, "국립서울과학관으로 보임"],
  "건강의 벗": ["개인", true, "운영 주체 확인"], "에코센터 TV": ["단체", true, "운영 주체 확인"],
  "광복회TV": ["단체", true, "법정 단체"], "민주화운동기념사업회_Kdemocracy": ["정부·공공기관"], "유성문화원": ["단체", true, "지방문화원"],
  "관악문화재단TV": ["지자체", false, "관악구 재단"], "KPF한국언론진흥재단": ["정부·공공기관"], "환경재단K-GREEN FOUNDATION": ["단체"],
  "그린코리아포럼": ["단체"], "서울환경연합": ["단체"], "세이브더칠드런": ["단체"], "UNICEF KOREA": ["단체"], "사단법인 시민": ["단체"],
  "유네스코한국위원회 - KNCU": ["정부·공공기관"], "공식 환경보호 채널.": ["개인", true],
  "국가인적자원개발컨소시엄": ["정부·공공기관"], "한국지능정보사회진흥원 스마트쉼센터": ["정부·공공기관"],
  "한국분석시험연구원KATR": ["기업", true, "시험인증 기관 — 공공 여부 확인"],
  "한국등산트레킹지원센터": ["정부·공공기관"], "LX한국국토정보공사 Official": ["정부·공공기관"], "K-water 한국수자원공사 Official": ["정부·공공기관"],
  "한국전력 KEPCO": ["정부·공공기관"], "한국전력경기북부본부": ["정부·공공기관"], "한국교통안전공단 교통안전TV": ["정부·공공기관"],
  "한국환경공단": ["정부·공공기관"], "국민건강보험": ["정부·공공기관"], "보건복지부TV": ["정부·공공기관"], "금융감독원(Financial Supervisory Service)": ["정부·공공기관"],
  "한국은행": ["정부·공공기관"], "KDI": ["공공 연구기관"], "KDI 경제교육·정보센터": ["공공 연구기관"],
  "KISTI의 과학향기": ["공공 연구기관"], "KRRI한국철도기술연구원": ["공공 연구기관"], "국가과학기술연구회(nst)": ["공공 연구기관"],
  "한국항공우주연구원 KARI TV": ["공공 연구기관"], "한국천문연구원(KASI)": ["공공 연구기관"], "극지연구소": ["공공 연구기관"], "극지 톡톡": ["공공 연구기관", true, "극지연구소 계열로 보임"],
  "국토연구원": ["공공 연구기관"], "국사편찬위원회 National Institute of Korean History": ["정부·공공기관"],
  "독립기념관 The Independence Hall of Korea": ["국립 박물관·과학관"], "서대문자연사박물관": ["지자체", false, "서울 서대문구"],
  "[공식]부산과학체험관": ["지자체", true], "미래과학교육원TV": ["개인", true, "운영 주체 확인"],
  "강원대학교 지질학전공": ["대학·병원", true], "고대병원": ["대학·병원", true], "서울아산병원": ["대학·병원", true], "대구의료원": ["정부·공공기관"],
  "KHU INTERNATIONAL": ["대학·병원", true], "교육학과_HYUN": ["개인"], "심닥의 의학이야기": ["개인"],
  "경기온나눔콘텐츠": ["교육청·교육연구기관", true, "경기도교육청 계열로 보임"], "전북수업샘터": ["교육청·교육연구기관", true, "전북교육청 수업 나눔으로 보임"],
  "전남교육NOW": ["교육청·교육연구기관"], "경기평생교육학습관 번데기학교": ["교육청·교육연구기관", false, "경기도교육청 소속"],
  "대구창의융합교육원": ["교육청·교육연구기관"], "경상북도교육청과학원": ["교육청·교육연구기관"],
  "서울특별시교육청교육연구정보원": ["교육청·교육연구기관"], "중앙선거관리위원회선거연수원": ["정부·공공기관"],
  "국립평화통일민주교육원": ["정부·공공기관"], "국가환경교육센터": ["정부·공공기관"],
  "대안교육기관 하나서밋스쿨": ["개인"], "에듀가이드": ["개인", true], "온클래스": ["개인", true],
  "미래엔": ["교육 기업·출판사"], "비상교육(VisangEdu)": ["교육 기업·출판사"], "비상교육 온리원 라이브": ["교육 기업·출판사"], "비상교육 비바샘": ["교육 기업·출판사"],
  "지학사 티솔루션": ["교육 기업·출판사"], "아이스크림 홈런": ["교육 기업·출판사"], "대교 눈높이": ["교육 기업·출판사"], "스마트올TV": ["교육 기업·출판사", false, "웅진"],
  "지니스쿨 역사 GeniSchool History": ["교육 기업·출판사"], "이투스 현수쌤": ["교육 기업·출판사"], "키출판사": ["교육 기업·출판사"],
  "도서출판성우&성우주니어": ["교육 기업·출판사"], "초록개구리 출판사": ["교육 기업·출판사"], "전파과학사 Science Wave": ["교육 기업·출판사"],
  "LGScienceLand": ["기업"], "삼성SDI": ["기업"], "삼성전자 Samsung Electronics": ["기업"], "삼성전자 뉴스룸 [Samsung Newsroom]": ["기업"],
  "GS칼텍스": ["기업"], "유한킴벌리": ["기업"], "빙그레(Binggrae)": ["기업"], "KB국민은행": ["기업"], "해성마그네트": ["기업"], "CJ DONORSCAMP": ["기업"],
  "DocuRain 다큐레인": ["개인", true, "이름에 '다큐' — 방송사 아님으로 보임"], "바다 다큐": ["개인", true, "이름에 '다큐' — 방송사 아님으로 보임"],
  "산소DOCU": ["개인", true, "이름에 '다큐' — 방송사 아님으로 보임"], "KBS대전 [CULTURE&DOCUMENTARY]": ["방송(교양·다큐)"],
  "아꿈선 초등3분과학": ["단체", true, "교사 연구회(아름다운 꿈을 꾸는 선생님들) — 교육으로 올릴지"],
  "참쌤스쿨": ["단체", true, "교사 모임 — 교육으로 올릴지"], "참쌤튜브": ["단체", true, "교사 모임 — 교육으로 올릴지"],
  "보물섬독도TV": ["개인", true, "영상 11개 — 운영 주체 확인(공공 독도 채널일 수 있음)"], "독도강치TV": ["개인", true, "운영 주체 확인"],
  "지역N문화 ": ["정부·공공기관", true, "한국문화원연합회 지역문화 포털로 보임"], "클래스로그": ["개인", true, "영상 9개 — 운영 주체 확인"],
  "적정온 l 적정ON [적정기술과 메이커]": ["단체"], "에디스교육": ["교육 기업·출판사", true],
  "머니인사이드": ["개인", true, "운영 주체 확인"], "티디키즈 (인기 동요・동화)": ["기업"], "주니토니 - 인기 동요・동화": ["기업"], "리틀신비🎵 | 키즈 율동 동요": ["기업"],
  "깨비키즈 [KEBIKIDS]": ["기업"], "꼬마TV Kid's TV": ["기업"], "GoGoMovie 고고무비": ["개인"], "Y Pictures": ["개인", true],
};

// YouTube 채널 설명으로 확인(10/3) — 위 손 분류를 덮는다
const SEEN = "채널 설명 확인: ";
Object.assign(MANUAL, {
  "지역N문화 ": ["정부·공공기관", false, SEEN + "한국문화원연합회"], "에디스교육": ["교육 기업·출판사", false, SEEN + "어린이 경제교육 업체"],
  "공식 환경보호 채널.": ["개인", false, SEEN + "개인"], "산소DOCU": ["개인", false, SEEN + "순위형 정보 채널"], "바다 다큐": ["개인", false, SEEN + "개인 다큐 채널"],
  "DocuRain 다큐레인": ["개인", false, SEEN + "개인 다큐 채널"], "대구가이드": ["개인", false, SEEN + "대구 소개 개인 채널"],
  "IP STORY CENTER": ["정부·공공기관", false, SEEN + "지식재산처·한국발명진흥회"],
  "클래스로그": ["교육 기업·출판사", false, SEEN + "에듀립 — EBS 콘텐츠를 교과 진도에 맞춰 큐레이션"],
  "뉴스쿨TV by News'Cool": ["교육 기업·출판사", false, SEEN + "초등 뉴스 학습 플랫폼"],
  "전북수업샘터": ["교육청·교육연구기관", false, SEEN + "전북교육청교육연구정보원"], "경기온나눔콘텐츠": ["교육청·교육연구기관", false, SEEN + "경기도교육청"],
  "미래과학교육원TV": ["기업", false, SEEN + "초등 과학실험 교구 업체"], "생물누리TV": ["정부·공공기관", false, SEEN + "국립낙동강생물자원관"],
  "Y Pictures": ["개인", false, SEEN + "개인 제작사"], "건강의 벗": ["개인", false, SEEN + "건강 정보 채널"],
  "K-VIBE": ["언론(뉴스)", false, SEEN + "연합뉴스"], "다경뉴스TV": ["개인", false, SEEN + "뉴스 크리에이터(언론사 아님)"],
  "kculturechannel": ["공공 연구기관", false, SEEN + "한국학중앙연구원"], "경제배움e+": ["정부·공공기관", false, SEEN + "재정경제부 경제교육 플랫폼"],
  "독도강치TV": ["정부·공공기관", false, SEEN + "경상북도콘텐츠진흥원 애니메이션"], "온클래스": ["개인", false, SEEN + "교사 개인"],
  "K-팩트체커": ["정부·공공기관", false, SEEN + "KTV 정책 팩트체크"], "한국분석시험연구원KATR": ["기업", false, SEEN + "민간 시험기관"],
  "환경스페셜": ["방송(교양·다큐)", false, SEEN + "KBS 공식"], "대구는 요즘 어때?": ["개인", false, SEEN + "대구 소식 개인 채널"],
  "머니인사이드": ["개인", false, SEEN + "경제 정보 개인 채널"],
  "보물섬독도TV": ["개인", true, "채널 설명에 운영 주체 없음(독도 가족 콘텐츠) — 공공일 수 있음"],
  "극지 톡톡": ["공공 연구기관", true, "채널 설명 없음 — 극지연구소 계열로 보임"], "nsmscience": ["국립 박물관·과학관", true, "채널 설명 없음 — 국립서울과학관으로 보임"],
  "에코센터 TV": ["단체", true, "채널 설명 없음(@ndecocenter)"], "에듀가이드": ["개인", true, "채널 설명 없음"],
  "Korea UHD Showcase": ["개인", true, "채널 설명 없음"],
} as Record<string, [Kind, boolean?, string?]>);

// 이름 규칙(손 분류에 없을 때). 위에서부터 처음 맞는 것.
const RULES: [RegExp, Kind][] = [
  [/^EBS|EBS\s|\(EBS|EBS뉴스/, "EBS"],
  [/교육청|교육연구원|교육원$|교육연구정보원|교육부$/, "교육청·교육연구기관"],
  [/예능|Entertainment|ENT\b|tvN|JTBC (Life|Entertainment)|SBS (Entertainment|STORY)|MBCentertainment|MBN Entertainment/, "방송(예능)"],
  [/뉴스|News|NEWS|YTN|연합뉴스|MBC(?!.*Program)|SBS|KBS뉴스|KBS NEWS|KBS\s?(대전|창원|강원|충북)|JTBC|채널A|MBN/, "언론(뉴스)"],
  [/KBS|다큐|DOCU/, "방송(교양·다큐)"],
  [/국립|박물관|과학관|기념관|고궁/, "국립 박물관·과학관"],
  [/연구원|연구소/, "공공 연구기관"],
  [/부$|부TV|청$|청\s|처$|위원회|기상청|정부|공단|공사|진흥원|관리청|국가유산청|선거관리|통일부|해양수산부|국토교통부|행정안전부|국가보훈부|방위사업청|식품의약품안전처|질병관리청|국가데이터처|문화체육관광부|산업통상부|재정경제부|기후에너지환경부|방송미디어통신위원회|국립수목원|국립생태원/, "정부·공공기관"],
  [/구청|군청|시청|광역시|특별시|도청/, "지자체"],
];

const ROOT = path.resolve(import.meta.dirname, "../..");
const KITS = path.join(ROOT, "content/kits");
type Row = { channel: string; n: number; kits: Set<string>; titles: string[] };
const rows = new Map<string, Row>();
for (const f of fs.readdirSync(KITS).filter((f) => f.endsWith(".yaml")).sort()) {
  const kit = f.replace(/\.yaml$/, "");
  const text = fs.readFileSync(path.join(KITS, f), "utf8");
  // 항목 블록마다 title·channel 짝을 읽는다(파서 없이 — key: 시작 블록 단위)
  for (const block of text.split(/\n  - key: /).slice(1)) {
    const ch = block.match(/\n\s+channel: (.+)/)?.[1]?.trim().replace(/^["']|["']$/g, "");
    if (!ch) continue;
    const title = block.match(/\n\s+title: (.+)/)?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
    const r = rows.get(ch) ?? { channel: ch, n: 0, kits: new Set(), titles: [] };
    r.n++; r.kits.add(kit); if (r.titles.length < 2) r.titles.push(title);
    rows.set(ch, r);
  }
}

const out = [...rows.values()].map((r) => {
  const m = MANUAL[r.channel];
  let kind: Kind, check = false, memo = "", basis: string;
  if (m) { [kind, check = false, memo = ""] = [m[0], m[1] ?? false, m[2] ?? ""]; basis = "손 분류"; }
  else {
    const hit = RULES.find(([re]) => re.test(r.channel));
    if (hit) { kind = hit[1]; basis = `이름 규칙 ${hit[0].source.slice(0, 24)}`; }
    else { kind = "개인"; basis = "규칙 없음 → 개인"; }
  }
  if (kind === "방송(예능)" && !check) { check = true; memo ||= "예능 클립 — 언론·방송으로 둘지"; }
  return { ...r, kind, grade: GRADE[kind], check, memo, basis };
});
const order = { public: 0, edu: 1, press: 2, personal: 3 } as Record<string, number>;
out.sort((a, b) => Number(b.check) - Number(a.check) || order[a.grade] - order[b.grade] || b.n - a.n || a.channel.localeCompare(b.channel, "ko"));

// yaml 정본 초안 — 등급별 묶음, 채널 이름 순
const yq = (s: string) => JSON.stringify(s);
let yaml = "# 채널 등급 — 수업나래 실생활 맥락 탐구자료(출처 칩·고르기 순서)가 읽는다\n" +
  "# public: 공공기관·공공연구·지자체 · edu: 교육청·교육연구기관·EBS · press: 언론·방송 · personal: 개인·기업·단체\n" +
  "# 2026-10-03 초안(scripts/once/2026-10-03-channel-grades.ts) — 운영자 검수 전\n";
for (const g of ["public", "edu", "press", "personal"]) {
  yaml += `${g}:\n`;
  for (const r of out.filter((r) => r.grade === g).sort((a, b) => a.channel.localeCompare(b.channel, "ko"))) yaml += `  - ${yq(r.channel)}\n`;
}
fs.writeFileSync(path.join(ROOT, "content/channels.yaml"), yaml);

const LABEL: Record<string, string> = { public: "공공", edu: "교육", press: "언론·방송", personal: "개인·기업" };
const csvq = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
const head = ["확인 필요", "채널", "영상 수", "등급(초안)", "세부", "고칠 등급(빈칸=그대로)", "메모", "근거", "예시 영상", "꾸러미"];
const lines = [head.map(csvq).join(",")];
for (const r of out) lines.push([r.check ? "확인" : "", r.channel, r.n, LABEL[r.grade], r.kind, "", r.memo, r.basis, r.titles.join(" / "), [...r.kits].join(" ")].map(csvq).join(","));
fs.mkdirSync(path.join(ROOT, "docs/drafts"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "docs/drafts/channel-grades-draft.csv"), "﻿" + lines.join("\r\n") + "\r\n");

const sum = (f: (r: typeof out[number]) => boolean) => out.filter(f).reduce((a, r) => [a[0] + 1, a[1] + r.n], [0, 0]);
for (const g of ["public", "edu", "press", "personal"]) { const [c, v] = sum((r) => r.grade === g); console.log(`${g}\t채널 ${c}\t영상 ${v}`); }
const [cc, cv] = sum((r) => r.check); console.log(`확인 필요\t채널 ${cc}\t영상 ${cv}`);
const [dc, dv] = sum((r) => r.basis.startsWith("규칙 없음")); console.log(`규칙 없음→개인\t채널 ${dc}\t영상 ${dv}`);
console.log(`합계 채널 ${out.length}`);
