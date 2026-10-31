// Классификатор медицинских документов и генератор унифицированных имён файлов.
// Поддерживает:
//   1. Разбор уже переименованных файлов: ГГГГ-ММ-ДД_Тип_Детали_[Маркер]_Клиника.ext
//   2. Автоопределение даты, типа, направления, клиники и предложенного имени по тексту PDF/OCR.

export const FOLDERS = {
  cardio: '01_Кардиология_и_Сосуды',
  uro: '02_Урология',
  gastro: '03_Гастроэнтерология_и_УЗИ_БП',
  ortho: '04_Ортопедия_и_Травматология',
  lab: '05_Лабораторные_анализы',
  prev: '06_Профилактика_Реабилитация_Разное',
};

const FOLDER_TO_SPECIALTY = Object.fromEntries(
  Object.entries(FOLDERS).map(([k, v]) => [v, k]),
);

const STANDARD_NAME_RE = /^(\d{4}-\d{2}-\d{2})_(.+)\.(pdf|jpe?g|png)$/i;

/** Известные клиники/лаборатории в названиях файлов. */
const KNOWN_CLINICS = [
  { match: /InMedica/i, label: 'InMedica' },
  { match: /Kardiolita/i, label: 'Kardiolita' },
  { match: /Meliva/i, label: 'Meliva' },
  { match: /Anteja|Antėja/i, label: 'Antėja' },
  { match: /Helix/i, label: 'Helix Гродно' },
  { match: /Affidea/i, label: 'Affidea Алитус' },
  { match: /Grand_SPA_Lietuva/i, label: 'Grand SPA Lietuva' },
  { match: /Santaros_klinikos/i, label: 'Santaros klinikos' },
  { match: /Гродно_ЛОДЭ|ЛОДЭ/i, label: 'ЛОДЭ Гродно' },
  { match: /Гродно_УК/i, label: 'Гродненская УК' },
  { match: /Друскининкай/i, label: 'Друскининкай' },
  { match: /Каунас/i, label: 'Каунасская поликлиника' },
  { match: /Алитус/i, label: 'Алитус' },
];

/** Определение типа документа по ключевым словам в имени файла. */
const DOC_TYPE_RULES = [
  { match: /^Анализ_|Комплексный_анализ|Липидограмма|Расширенная_липидограмма|Общий_анализ_мочи/i, docType: 'Анализ' },
  { match: /^КТ_|Коронарография/i, docType: 'КТ' },
  { match: /^МРТ_|_МРТ_/i, docType: 'МРТ' },
  { match: /^УЗИ_|_УЗИ_/i, docType: 'УЗИ' },
  { match: /^Рентген_/i, docType: 'Рентген' },
  { match: /^ЭКГ_/i, docType: 'ЭКГ' },
  { match: /^Холтер_/i, docType: 'Холтер' },
  { match: /^ВЭМ_|^Тредмил_/i, docType: 'Нагрузочный тест' },
  { match: /^Направление_/i, docType: 'Направление' },
  { match: /^Рецепт_/i, docType: 'Рецепт' },
  { match: /^Вакцинация_/i, docType: 'Вакцинация' },
  { match: /^Выписка_/i, docType: 'Выписка' },
  { match: /Кардиолог|Уролог|Гастроэнтеролог|Ортопед|Семейный_врач/i, docType: 'Консультация' },
];

/** Извлечение встроенных маркеров из имени файла (ПСА-7.015, CAC-288, CAD-RADS-2, PIRADS-2, СРБ-190, Доза-1). */
export function extractMarkersFromName(stem) {
  const markers = [];
  const patterns = [
    { re: /ПСА-(\d+(?:[.,]\d+)?)/i, label: (m) => `ПСА ${m[1]}` },
    { re: /СРБ-(\d+(?:[.,]\d+)?)/i, label: (m) => `СРБ ${m[1]}` },
    { re: /CAC-(\d+)/i, label: (m) => `CAC ${m[1]}` },
    { re: /CAD-RADS-(\d+)/i, label: (m) => `CAD-RADS ${m[1]}` },
    { re: /PIRADS-(\d+)/i, label: (m) => `PI-RADS ${m[1]}` },
    { re: /SCORE2/i, label: () => 'SCORE2' },
    { re: /Доза-(\d+)/i, label: (m) => `Доза ${m[1]}` },
  ];
  for (const p of patterns) {
    const m = stem.match(p.re);
    if (m) markers.push(p.label(m));
  }
  return markers;
}

/**
 * Разбирает имя файла и папку в структурированное описание документа.
 * @param {string} folderName имя папки (напр. 01_Кардиология_и_Сосуды)
 * @param {string} fileName имя файла
 */
export function parseDocumentFilename(folderName, fileName) {
  const specialty = FOLDER_TO_SPECIALTY[folderName] ?? 'prev';
  const extMatch = fileName.match(/\.([^.]+)$/);
  const fileType = extMatch ? extMatch[1].toLowerCase() : 'pdf';
  const m = fileName.match(STANDARD_NAME_RE);

  if (!m) {
    return {
      isStandardName: false,
      date: null,
      specialty,
      folder: folderName,
      fileName,
      fileType,
      docType: 'Документ',
      clinic: 'Не указана',
      titleRu: fileName.replace(/\.[^.]+$/, ''),
      markers: [],
    };
  }

  const [, date, rest] = m;
  let docType = 'Документ';
  for (const rule of DOC_TYPE_RULES) {
    if (rule.match.test(rest)) {
      docType = rule.docType;
      break;
    }
  }

  let clinic = 'Алитус';
  for (const c of KNOWN_CLINICS) {
    if (c.match.test(rest)) {
      clinic = c.label;
      break;
    }
  }

  const markers = extractMarkersFromName(rest);
  const humanTitle = rest
    .replace(/_/g, ' ')
    .replace(/\b(InMedica|Kardiolita|Meliva|Anteja|Helix|Affidea)\b/g, '($1)')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    isStandardName: true,
    date,
    specialty,
    folder: folderName,
    fileName,
    fileType,
    docType,
    clinic,
    titleRu: humanTitle,
    markers,
  };
}

/**
 * Классифицирует непереименованный документ по его извлечённому тексту
 * и предлагает унифицированное имя и целевую папку.
 * @param {string} text текст документа
 * @param {string} originalFileName исходное имя файла
 */
export function classifyDocumentByText(text, originalFileName = 'document.pdf') {
  const extMatch = originalFileName.match(/\.([^.]+)$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : 'pdf';
  const norm = text || '';

  // 1. Извлечение даты исследования / визита / заказа
  const datePatterns = [
    /Tyrimo data(?:\s+ir\s+laikas)?:\s*(\d{4}-\d{2}-\d{2})/i,
    /Ambulatorinės gydymo paslaugos suteikimas[^,\n]*,\s*data\s+(\d{4}-\d{2}-\d{2})/i,
    /Siuntimo\s*\/\s*išrašo duomenys:\s*(\d{4}-\d{2}-\d{2})/i,
    /Užsakymo data:\s*(\d{4}-\d{2}-\d{2})/i,
    /(\d{2})\.(\d{2})\.(\d{4})\s+\d{1,2}:\d{2}\s*Дата заказа/i,
    /\b(202[0-9]-\d{2}-\d{2})\b/,
  ];

  let date = null;
  for (const re of datePatterns) {
    const m = norm.match(re);
    if (m) {
      date = m[3] ? `${m[3]}-${m[2]}-${m[1]}` : m[1];
      break;
    }
  }

  // 2. Определение клиники и города
  let clinicSlug = 'Алитус';
  if (/Affidea/i.test(norm)) {
    clinicSlug = /Alytus/i.test(norm) ? 'Affidea_Алитус' : 'Affidea';
  } else if (/Kardiolita/i.test(norm)) {
    clinicSlug = 'Kardiolita';
  } else if (/Meliva laboratorija/i.test(norm)) {
    clinicSlug = 'Meliva';
  } else if (/ANTĖJA|kraujotyrimai\.lt/i.test(norm)) {
    clinicSlug = 'Anteja';
  } else if (/Хеликс|HELIX/i.test(norm)) {
    clinicSlug = 'Гродно_Helix';
  } else if (/Grand SPA Lietuva/i.test(norm)) {
    clinicSlug = 'Grand_SPA_Lietuva';
  } else if (/Santaros klinikos/i.test(norm)) {
    clinicSlug = 'Santaros_klinikos';
  } else if (/Kauno miesto poliklinika/i.test(norm)) {
    clinicSlug = 'Каунас';
  } else if (/Druskininkų ligoninė/i.test(norm)) {
    clinicSlug = 'Друскининкай';
  } else if (/InMedica/i.test(norm)) {
    clinicSlug = 'InMedica';
  } else if (/S\.\s*Kudirkos ligoninė|Alytaus poliklinika/i.test(norm)) {
    clinicSlug = 'Алитус';
  }

  // 3. Определение типа исследования и направления по медицинским маркерам текста
  let specialty = 'prev';
  let slug = 'Документ_Описание';
  let confidence = 'medium';

  if (/Klubo\s*\(Kairio\)\s*magnetinio rezonanso tomografija|Dubens magnetinis rezonansas/i.test(norm)) {
    specialty = 'ortho';
    slug = 'МРТ_Левый_тазобедренный_сустав_Описание';
    confidence = 'high';
  } else if (/Vainikinių arterijų kalcinozės indeksas|CAD-RADS/i.test(norm)) {
    specialty = 'cardio';
    const cac = norm.match(/Agatston['’aą]*\s+lygus\s+(\d+)/i)?.[1];
    const cadrads = norm.match(/CAD-RADS\s*(\d+)/i)?.[1];
    slug = `КТ_Коронарография${cac ? `_CAC-${cac}` : ''}${cadrads ? `_CAD-RADS-${cadrads}` : ''}`;
    confidence = 'high';
  } else if (/Pilvo ultragarsinis tyrimas|Tulžies pūslė/i.test(norm)) {
    specialty = 'gastro';
    slug = 'Гастроэнтеролог_УЗИ_Брюшной_полости_и_почек';
    confidence = 'high';
  } else if (/Kelis Stovint/i.test(norm)) {
    specialty = 'ortho';
    slug = 'Рентген_Левый_коленный_сустав_Описание';
    confidence = 'high';
  } else if (/Dubuo Stovint/i.test(norm)) {
    specialty = 'ortho';
    slug = 'Рентген_Тазобедренные_суставы_Описание';
    confidence = 'high';
  } else if (/LABORATORINIŲ TYRIMŲ PROTOKOLAS|TYRIMO PROTOKOLAS|Международная лаборатория Хеликс/i.test(norm)) {
    specialty = 'lab';
    slug = /Šlapimas/i.test(norm) && !/Kraujas/i.test(norm)
      ? 'Общий_анализ_мочи'
      : 'Комплексный_анализ_крови';
    confidence = 'high';
  } else if (/TicoVac|Erkinis encefalitas/i.test(norm)) {
    specialty = 'prev';
    const dose = norm.match(/TicoVac,\s*(\d)\s*dozė/i)?.[1] ?? '1';
    slug = `Вакцинация_Клещевой_энцефалит_TicoVac_Доза-${dose}`;
    confidence = 'high';
    clinicSlug = '';
  } else if (/Gydytojas kardiologas/i.test(norm)) {
    specialty = 'cardio';
    slug = 'Кардиолог_Консультация';
    confidence = 'high';
  } else if (/Gydytojas urologas/i.test(norm)) {
    specialty = 'uro';
    slug = 'Уролог_Консультация';
    confidence = 'high';
  } else if (/Gydytojas ortopedas traumatologas/i.test(norm)) {
    specialty = 'ortho';
    slug = /SIUNTIMAS/i.test(norm) ? 'Направление_Ортопед_травматолог' : 'Ортопед_Консультация_Трохантерит';
    confidence = 'high';
  } else {
    confidence = 'low';
  }

  const datePart = date ?? '0000-00-00';
  const clinicPart = clinicSlug ? `_${clinicSlug}` : '';
  const proposedName = `${datePart}_${slug}${clinicPart}.${ext}`;

  return {
    date,
    specialty,
    proposedFolder: FOLDERS[specialty],
    proposedName,
    confidence: date ? confidence : 'low',
  };
}
