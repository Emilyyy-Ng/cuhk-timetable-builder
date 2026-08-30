// frontend/src/utils/locations.js
const BUILDING_MAPPINGS = [
  ['AB', 'Academic Building', '教研樓'],
  ['AB1', 'Academic Building I', '教研樓一'],
  ['ARC', 'Lee Shau Kee Architecture Building', '李兆基建築學大樓'],
  ['AMEW', 'Art Museum East Wing', '中國文化研究所文物館東翼'],
  ['BATC', 'MBA Town Centre', '美國銀行中心'],
  ['BMS', 'Basic Medical Sciences Building', '基本醫學大樓'],
  ['CCCC', 'Chung Chi College Chapel', '崇基禮拜堂'],
  ['CCT', 'Chung Chi College Theology Building', '崇基神學樓'],
  ['CKB', 'Chen Kou Bun Building', '陳國本樓'],
  ['CK TSE', 'C.K. Tse Room', '謝昭杰室'],
  ['CML', "Ch'ien Mu Library", '錢穆圖書館'],
  ['CWC', 'C.W. Chu College', '敬文書院'],
  ['CYT', 'Cheng Yu Tung Building', '鄭裕彤樓'],
  ['ELB', 'Esther Lee Building', '利黃瑤璧樓'],
  ['ERB', 'William M W Mong Engineering Building', '蒙民偉工程學大樓'],
  ['FYB', 'Wong Foo Yuan Building', '王福元樓'],
  ['HCA', "Pi-Ch'iu Building", '碧秋樓'],
  ['HCF', 'Sir Philip Haddon-Cave Sports Field', '夏鼎基運動場'],
  ['HKSP', 'Hong Kong Science And Technology Parks Corporation', '香港科技園'],
  ['HTB', 'Ho Tim Building', '何添樓'],
  ['HTC', 'Haddon-Cave Tennis Court', '6,7號夏鼎基網球場'],
  ['HYS', 'Hui Yeung Shing Building', '許讓成樓'],
  ['ICS', 'Institute of Chinese Studies', '中國文化研究所'],
  ['KHB', 'Fung King Hey Building', '馮景禧樓'],
  ['KKB', 'Leung Kau Kui Building', '梁銶琚樓'],
  ['KSB', 'Kwok Sports Building', '汾陽體育樓'],
  ['KSB SQ', 'Squash Court, Kwok Sports Building', '汾陽體育樓壁球場'],
  ['KSB SQ', 'Kwok Sports Building Squash Court', '汾陽體育樓壁球場'],
  ['LDS', 'Li Dak Sum Building', '李達三樓'],
  ['LHC', 'Y.C. Liang Hall', '潤昌堂'],
  ['LKC', 'Li Koon Chun Hall', '李冠春堂'],
  ['LN', 'Lingnan Stadium', '嶺南體育館'],
  ['LN', 'Lingnan Stadium, Chung Chi College', '嶺南體育館'],
  ['LPN LT', 'Lai Chan Pui Ngong LT', '黎陳佩昂講堂'],
  ['LSB', 'Lady Shaw Building', '邵逸夫夫人樓'],
  ['LSK', 'Lee Shau Kee Building', '李兆基樓'],
  ['MCO', 'Morningside College Seminar Room', '晨興書院研討室'],
  ['MMW', 'Mong Man Wai Building', '蒙民偉樓'],
  ['NAA', 'Cheng Ming Building', '誠明館'],
  ['NAG', 'New Asia College Gymnasium', '新亞體育館'],
  ['NAH', 'Humanities Building', '人文館'],
  ['NA TT', 'Table Tennis Room, New Asia College', '新亞書院乒乓球室'],
  ['PWH', 'Prince of Wales Hospital', '威爾斯親王醫院'],
  ['RRS', 'Sir Run Run Shaw Hall', '邵逸夫堂'],
  ['SB', 'Sino Building', '信和樓'],
  ['SC', 'Science Centre', '科學館'],
  ['SCE', 'Science Centre East Block', '科學館東座'],
  ['SCSH', 'Multi-purpose Sports Hall, Shaw College', '逸夫書院室內體育及多功能館'],
  ['SCTT', 'Table Tennis Room, Shaw College', '逸夫書院乒乓球室'],
  ['SHB', 'Ho Sin-Hang Engineering Building', '何善衡工程大樓'],
  ['SP', 'Swimming Pool', '游泳池'],
  ['SWC LT', 'Lecture Theatre, Shaw College', '大講堂'],
  ['SWH', 'Swire Hall', '太古堂'],
  ['TC', 'Tennis Court', '網球場'],
  ['TYW LT', 'T.Y. Wong Hall', '王統元堂'],
  ['TYW LT', 'T.Y.Wong Hall', '王統元堂'],
  ['UCA', 'Tsang Shiu Tim Building', '曾肇添樓'],
  ['UCC', 'T.C. Cheng Building', '鄭棟材樓'],
  ['UCG', 'United College Gymnasium', '聯合體育館'],
  ['UCG', 'The Thomas H.C. Cheung Gym, United College', '聯合體育館'],
  ['UC TT', 'Table Tennis Room, United College', '聯合書院乒乓球室'],
  ['UG', 'University Gymnasium', '大學體育館'],
  ['USC', 'University Sports Centre', '大學體育中心'],
  ['USC TT', 'Table Tennis Room, University Sports Centre', '大學體育中心乒乓球室'],
  ['WLS', 'Wen Lan Tang', '文瀾堂'],
  ['WMY', 'Wu Ho Man Yuen Building', '伍何曼原樓'],
  ['WS1', 'Lee W.S. College South Block', '和聲書院南座'],
  ['YIA', 'Yasumoto International Academic Park', '康本國際學術園'],
  ['TBA', 'No Room Required', '無課室']
];

export const getLocationShortForm = (locStr) => {
  if (!locStr) return locStr;
  let str = locStr.replace(/\bbldg\b/gi, 'Building')
                  .replace(/\bmed\b/gi, 'Medical')
                  .replace(/\bsci\b/gi, 'Sciences')
                  .replace(/\bengg\b/gi, 'Engineering')
                  .replace(/\beng\b/gi, 'Engineering')
                  .replace(/\barchi\b/gi, 'Architecture')
                  .replace(/\bsport\b/gi, 'Sports')
                  .replace(/\bF\b/gi, 'Field')
                  .replace(/\bSC\b/gi, 'Shaw College')
                  .replace(/\bUC\b/gi, 'United College')
                  .replace(/\bNA\b/gi, 'New Asia College')
                  .replace(/\bCC\b/gi, 'Chung Chi')
                  .replace(/\bUC\b/gi, 'United College')
                  .replace(/\bU\b/gi, 'University')
                  .replace(/\bCentr\b/gi, 'Centre')
                  .replace(/\bCenter\b/gi, 'Centre')
                  .replace(/\bCtr\b/gi, 'Centre')
                  .replace(/\bRm\b/gi, 'Room')
                  .replace(/\bAcad\b/gi, 'Academic')
                  .replace(/\bInt'l\b/gi, 'International')
                  .replace(/\bChin\b/gi, 'Chinese');
  
  const mappings = [];
  for (const [abbr, eng, chi] of BUILDING_MAPPINGS) {
    mappings.push([eng, abbr]);
    mappings.push([chi, abbr]);
  }
  mappings.sort((a, b) => b[0].length - a[0].length);
  
  for (const [name, abbr] of mappings) {
    const regex = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    str = str.replace(regex, abbr);
  }
  return str;
};