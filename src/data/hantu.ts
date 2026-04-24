export interface CharacterInfo {
  char: string;
  hanViet: string;
  meaning: string;
  radical: string;
  radicalName: string;
  components: string[];
  componentMeanings: string[];
  strokeCount: number;
  pinyin: string;
}

export const HANTU_DATA: Record<string, CharacterInfo> = {
  // Numbers
  "一": { char: "一", hanViet: "nhất", meaning: "một, thứ nhất, duy nhất", radical: "一", radicalName: "bộ nhất (一)", components: ["一"], componentMeanings: ["一 (nhất - một)"], strokeCount: 1, pinyin: "yī" },
  "二": { char: "二", hanViet: "nhị", meaning: "hai, thứ hai", radical: "二", radicalName: "bộ nhị (二)", components: ["二"], componentMeanings: ["二 (nhị - hai)"], strokeCount: 2, pinyin: "èr" },
  "三": { char: "三", hanViet: "tam", meaning: "ba, thứ ba", radical: "三", radicalName: "bộ nhất (一)", components: ["三"], componentMeanings: ["三 (tam - ba)"], strokeCount: 3, pinyin: "sān" },
  "四": { char: "四", hanViet: "tứ", meaning: "bốn, thứ tư", radical: "囗", radicalName: "bộ vi (囗)", components: ["囗", "儿"], componentMeanings: ["囗 (vi - vây quanh)", "儿 (nhân - người)"], strokeCount: 5, pinyin: "sì" },
  "五": { char: "五", hanViet: "ngũ", meaning: "năm, thứ năm", radical: "二", radicalName: "bộ nhị (二)", components: ["五"], componentMeanings: ["五 (ngũ - năm)"], strokeCount: 4, pinyin: "wǔ" },
  "六": { char: "六", hanViet: "lục", meaning: "sáu, thứ sáu", radical: "八", radicalName: "bộ bát (八)", components: ["亠", "八"], componentMeanings: ["亠 (đầu)", "八 (bát - tám)"], strokeCount: 4, pinyin: "liù" },
  "七": { char: "七", hanViet: "thất", meaning: "bảy, thứ bảy", radical: "一", radicalName: "bộ nhất (一)", components: ["七"], componentMeanings: ["七 (thất - bảy)"], strokeCount: 2, pinyin: "qī" },
  "八": { char: "八", hanViet: "bát", meaning: "tám, thứ tám", radical: "八", radicalName: "bộ bát (八)", components: ["八"], componentMeanings: ["八 (bát - tám)"], strokeCount: 2, pinyin: "bā" },
  "九": { char: "九", hanViet: "cửu", meaning: "chín, thứ chín", radical: "乙", radicalName: "bộ ất (乙)", components: ["九"], componentMeanings: ["九 (cửu - chín)"], strokeCount: 2, pinyin: "jiǔ" },
  "十": { char: "十", hanViet: "thập", meaning: "mười, thứ mười", radical: "十", radicalName: "bộ thập (十)", components: ["十"], componentMeanings: ["十 (thập - mười)"], strokeCount: 2, pinyin: "shí" },
  "百": { char: "百", hanViet: "bách", meaning: "trăm, một trăm, rất nhiều", radical: "白", radicalName: "bộ bạch (白)", components: ["一", "白"], componentMeanings: ["一 (nhất - một)", "白 (bạch - trắng)"], strokeCount: 6, pinyin: "bǎi" },
  "千": { char: "千", hanViet: "thiên", meaning: "nghìn, một nghìn", radical: "十", radicalName: "bộ thập (十)", components: ["千"], componentMeanings: ["千 (thiên - nghìn)"], strokeCount: 3, pinyin: "qiān" },
  "万": { char: "万", hanViet: "vạn", meaning: "mười nghìn, vạn, vô số", radical: "一", radicalName: "bộ nhất (一)", components: ["万"], componentMeanings: ["万 (vạn - mười nghìn)"], strokeCount: 3, pinyin: "wàn" },

  // Nature & Five Elements
  "日": { char: "日", hanViet: "nhật", meaning: "mặt trời, ngày, ngày tháng", radical: "日", radicalName: "bộ nhật (日)", components: ["日"], componentMeanings: ["日 (nhật - mặt trời)"], strokeCount: 4, pinyin: "rì" },
  "月": { char: "月", hanViet: "nguyệt", meaning: "mặt trăng, tháng", radical: "月", radicalName: "bộ nguyệt (月)", components: ["月"], componentMeanings: ["月 (nguyệt - trăng)"], strokeCount: 4, pinyin: "yuè" },
  "明": { char: "明", hanViet: "minh", meaning: "sáng, rõ ràng, thông minh, bình minh", radical: "日", radicalName: "bộ nhật (日)", components: ["日", "月"], componentMeanings: ["日 (nhật - mặt trời)", "月 (nguyệt - mặt trăng)"], strokeCount: 8, pinyin: "míng" },
  "星": { char: "星", hanViet: "tinh", meaning: "ngôi sao, hành tinh, tia sáng", radical: "日", radicalName: "bộ nhật (日)", components: ["日", "生"], componentMeanings: ["日 (nhật - mặt trời)", "生 (sinh - sống)"], strokeCount: 9, pinyin: "xīng" },
  "山": { char: "山", hanViet: "sơn", meaning: "núi, ngọn núi, vùng núi", radical: "山", radicalName: "bộ sơn (山)", components: ["山"], componentMeanings: ["山 (sơn - núi)"], strokeCount: 3, pinyin: "shān" },
  "水": { char: "水", hanViet: "thủy", meaning: "nước, sông, lỏng", radical: "水", radicalName: "bộ thủy (水)", components: ["水"], componentMeanings: ["水 (thủy - nước)"], strokeCount: 4, pinyin: "shuǐ" },
  "火": { char: "火", hanViet: "hỏa", meaning: "lửa, hỏa hoạn, nóng giận", radical: "火", radicalName: "bộ hỏa (火)", components: ["火"], componentMeanings: ["火 (hỏa - lửa)"], strokeCount: 4, pinyin: "huǒ" },
  "木": { char: "木", hanViet: "mộc", meaning: "gỗ, cây cối, thô kệch", radical: "木", radicalName: "bộ mộc (木)", components: ["木"], componentMeanings: ["木 (mộc - gỗ)"], strokeCount: 4, pinyin: "mù" },
  "土": { char: "土", hanViet: "thổ", meaning: "đất, thổ địa, đất nước", radical: "土", radicalName: "bộ thổ (土)", components: ["土"], componentMeanings: ["土 (thổ - đất)"], strokeCount: 3, pinyin: "tǔ" },
  "金": { char: "金", hanViet: "kim", meaning: "vàng, kim loại, tiền bạc", radical: "金", radicalName: "bộ kim (金)", components: ["金"], componentMeanings: ["金 (kim - vàng)"], strokeCount: 8, pinyin: "jīn" },
  "风": { char: "风", hanViet: "phong", meaning: "gió, phong tục, tin tức", radical: "风", radicalName: "bộ phong (风)", components: ["风"], componentMeanings: ["风 (phong - gió)"], strokeCount: 4, pinyin: "fēng" },
  "雨": { char: "雨", hanViet: "vũ", meaning: "mưa, mưa xuống", radical: "雨", radicalName: "bộ vũ (雨)", components: ["雨"], componentMeanings: ["雨 (vũ - mưa)"], strokeCount: 8, pinyin: "yǔ" },
  "雪": { char: "雪", hanViet: "tuyết", meaning: "tuyết, tuyết rơi, trắng tinh", radical: "雨", radicalName: "bộ vũ (雨)", components: ["雨", "彐"], componentMeanings: ["雨 (vũ - mưa)", "彐 (kí - đầu heo)"], strokeCount: 11, pinyin: "xuě" },
  "云": { char: "云", hanViet: "vân", meaning: "mây, vân, nói (cổ)", radical: "二", radicalName: "bộ nhị (二)", components: ["二", "厶"], componentMeanings: ["二 (nhị - hai)", "厶 (tư - riêng tư)"], strokeCount: 4, pinyin: "yún" },
  "天": { char: "天", hanViet: "thiên", meaning: "trời, bầu trời, ngày, trời xanh", radical: "大", radicalName: "bộ đại (大)", components: ["一", "大"], componentMeanings: ["一 (nhất - một)", "大 (đại - lớn)"], strokeCount: 4, pinyin: "tiān" },
  "地": { char: "地", hanViet: "địa", meaning: "đất, mặt đất, nơi chốn, địa vị", radical: "土", radicalName: "bộ thổ (土)", components: ["土", "也"], componentMeanings: ["土 (thổ - đất)", "也 (dã - cũng)"], strokeCount: 6, pinyin: "dì/de" },

  // People & Family
  "人": { char: "人", hanViet: "nhân", meaning: "người, con người, nhân vật", radical: "人", radicalName: "bộ nhân (人)", components: ["人"], componentMeanings: ["人 (nhân - người)"], strokeCount: 2, pinyin: "rén" },
  "女": { char: "女", hanViet: "nữ", meaning: "người nữ, phụ nữ, con gái", radical: "女", radicalName: "bộ nữ (女)", components: ["女"], componentMeanings: ["女 (nữ - người nữ)"], strokeCount: 3, pinyin: "nǚ" },
  "男": { char: "男", hanViet: "nam", meaning: "người nam, đàn ông, con trai", radical: "田", radicalName: "bộ điền (田)", components: ["田", "力"], componentMeanings: ["田 (điền - ruộng)", "力 (lực - sức mạnh)"], strokeCount: 7, pinyin: "nán" },
  "子": { char: "子", hanViet: "tử", meaning: "con, con cái, đứa trẻ, hạt", radical: "子", radicalName: "bộ tử (子)", components: ["子"], componentMeanings: ["子 (tử - đứa trẻ)"], strokeCount: 3, pinyin: "zǐ/zi" },
  "好": { char: "好", hanViet: "hảo", meaning: "tốt, tốt đẹp, thích, yêu thích", radical: "女", radicalName: "bộ nữ (女)", components: ["女", "子"], componentMeanings: ["女 (nữ - người nữ)", "子 (tử - đứa trẻ)"], strokeCount: 6, pinyin: "hǎo/hào" },
  "父": { char: "父", hanViet: "phụ", meaning: "cha, bố, người cha", radical: "父", radicalName: "bộ phụ (父)", components: ["父"], componentMeanings: ["父 (phụ - cha)"], strokeCount: 4, pinyin: "fù" },
  "母": { char: "母", hanViet: "mẫu", meaning: "mẹ, bà mẹ, nguồn gốc", radical: "母", radicalName: "bộ mẫu (母)", components: ["母"], componentMeanings: ["母 (mẫu - mẹ)"], strokeCount: 5, pinyin: "mǔ" },
  "兄": { char: "兄", hanViet: "huynh", meaning: "anh, anh trai", radical: "儿", radicalName: "bộ nhân (儿)", components: ["口", "儿"], componentMeanings: ["口 (khẩu - miệng)", "儿 (nhân - người)"], strokeCount: 5, pinyin: "xiōng" },
  "弟": { char: "弟", hanViet: "đệ", meaning: "em trai, người em", radical: "弓", radicalName: "bộ cung (弓)", components: ["弓", "丿", "弗"], componentMeanings: ["弓 (cung - cái cung)", "丿 (phiệt)", "弗 (phất - không)"], strokeCount: 7, pinyin: "dì" },
  "姐": { char: "姐", hanViet: "tỷ", meaning: "chị, chị gái", radical: "女", radicalName: "bộ nữ (女)", components: ["女", "且"], componentMeanings: ["女 (nữ - người nữ)", "且 (thả - vả lại)"], strokeCount: 8, pinyin: "jiě" },
  "妹": { char: "妹", hanViet: "muội", meaning: "em gái, cô em", radical: "女", radicalName: "bộ nữ (女)", components: ["女", "未"], componentMeanings: ["女 (nữ - người nữ)", "未 (vị - chưa)"], strokeCount: 8, pinyin: "mèi" },
  "夫": { char: "夫", hanViet: "phu", meaning: "chồng, người chồng, người đàn ông", radical: "大", radicalName: "bộ đại (大)", components: ["大", "一"], componentMeanings: ["大 (đại - lớn)", "一 (nhất - một)"], strokeCount: 4, pinyin: "fū/fú" },
  "妻": { char: "妻", hanViet: "thê", meaning: "vợ, người vợ", radical: "女", radicalName: "bộ nữ (女)", components: ["女", "㐱"], componentMeanings: ["女 (nữ - người nữ)"], strokeCount: 8, pinyin: "qī" },
  "友": { char: "友", hanViet: "hữu", meaning: "bạn bè, bạn hữu, thân thiện", radical: "又", radicalName: "bộ hữu (又)", components: ["ナ", "又"], componentMeanings: ["ナ (phiên âm)", "又 (hữu - lại)"], strokeCount: 4, pinyin: "yǒu" },

  // Body parts
  "头": { char: "头", hanViet: "đầu", meaning: "đầu, đầu óc, đỉnh, cái đầu", radical: "大", radicalName: "bộ đại (大)", components: ["大", "㇒"], componentMeanings: ["大 (đại - lớn)"], strokeCount: 5, pinyin: "tóu" },
  "手": { char: "手", hanViet: "thủ", meaning: "tay, bàn tay, người giỏi", radical: "手", radicalName: "bộ thủ (手)", components: ["手"], componentMeanings: ["手 (thủ - tay)"], strokeCount: 4, pinyin: "shǒu" },
  "足": { char: "足", hanViet: "túc", meaning: "chân, đủ, đầy đủ", radical: "足", radicalName: "bộ túc (足)", components: ["口", "止"], componentMeanings: ["口 (khẩu - miệng)", "止 (chỉ - dừng)"], strokeCount: 7, pinyin: "zú/jù" },
  "口": { char: "口", hanViet: "khẩu", meaning: "miệng, cửa, lỗ hổng, khẩu phần", radical: "口", radicalName: "bộ khẩu (口)", components: ["口"], componentMeanings: ["口 (khẩu - miệng)"], strokeCount: 3, pinyin: "kǒu" },
  "目": { char: "目", hanViet: "mục", meaning: "mắt, con mắt, điều mục, tiêu đề", radical: "目", radicalName: "bộ mục (目)", components: ["目"], componentMeanings: ["目 (mục - mắt)"], strokeCount: 5, pinyin: "mù" },
  "耳": { char: "耳", hanViet: "nhĩ", meaning: "tai, vành tai, lỗ tai", radical: "耳", radicalName: "bộ nhĩ (耳)", components: ["耳"], componentMeanings: ["耳 (nhĩ - tai)"], strokeCount: 6, pinyin: "ěr" },
  "心": { char: "心", hanViet: "tâm", meaning: "tim, tâm hồn, lòng dạ, trung tâm", radical: "心", radicalName: "bộ tâm (心)", components: ["心"], componentMeanings: ["心 (tâm - tim)"], strokeCount: 4, pinyin: "xīn" },
  "眼": { char: "眼", hanViet: "nhãn", meaning: "mắt, con mắt, lỗ hổng", radical: "目", radicalName: "bộ mục (目)", components: ["目", "艮"], componentMeanings: ["目 (mục - mắt)", "艮 (cấn - dừng lại)"], strokeCount: 11, pinyin: "yǎn" },

  // Basic adjectives / directions / concepts
  "大": { char: "大", hanViet: "đại", meaning: "lớn, to, vĩ đại, trưởng thành", radical: "大", radicalName: "bộ đại (大)", components: ["大"], componentMeanings: ["大 (đại - lớn)"], strokeCount: 3, pinyin: "dà/dài" },
  "小": { char: "小", hanViet: "tiểu", meaning: "nhỏ, bé, ít, hèn mọn", radical: "小", radicalName: "bộ tiểu (小)", components: ["小"], componentMeanings: ["小 (tiểu - nhỏ)"], strokeCount: 3, pinyin: "xiǎo" },
  "上": { char: "上", hanViet: "thượng", meaning: "trên, phía trên, lên, bậc trên", radical: "一", radicalName: "bộ nhất (一)", components: ["上"], componentMeanings: ["上 (thượng - trên)"], strokeCount: 3, pinyin: "shàng" },
  "下": { char: "下", hanViet: "hạ", meaning: "dưới, phía dưới, xuống, hạ xuống", radical: "一", radicalName: "bộ nhất (一)", components: ["下"], componentMeanings: ["下 (hạ - dưới)"], strokeCount: 3, pinyin: "xià" },
  "中": { char: "中", hanViet: "trung", meaning: "giữa, trung tâm, Trung Quốc, trúng", radical: "丨", radicalName: "bộ côn (丨)", components: ["口", "丨"], componentMeanings: ["口 (khẩu - miệng)", "丨 (côn - thẳng đứng)"], strokeCount: 4, pinyin: "zhōng/zhòng" },
  "长": { char: "长", hanViet: "trường/trưởng", meaning: "dài, lớn lên, trưởng thành, thủ lĩnh", radical: "长", radicalName: "bộ trường (长)", components: ["长"], componentMeanings: ["长 (trường - dài)"], strokeCount: 4, pinyin: "cháng/zhǎng" },
  "高": { char: "高", hanViet: "cao", meaning: "cao, cao cả, xuất sắc, đắt tiền", radical: "高", radicalName: "bộ cao (高)", components: ["高"], componentMeanings: ["高 (cao - cao)"], strokeCount: 10, pinyin: "gāo" },
  "多": { char: "多", hanViet: "đa", meaning: "nhiều, đa dạng, phong phú", radical: "夕", radicalName: "bộ tịch (夕)", components: ["夕", "夕"], componentMeanings: ["夕 (tịch - ban tối)", "夕 (tịch - ban tối)"], strokeCount: 6, pinyin: "duō" },
  "少": { char: "少", hanViet: "thiểu/thiếu", meaning: "ít, thiếu, nhỏ tuổi, ít ỏi", radical: "小", radicalName: "bộ tiểu (小)", components: ["小", "丿"], componentMeanings: ["小 (tiểu - nhỏ)", "丿 (phiệt)"], strokeCount: 4, pinyin: "shǎo/shào" },
  "新": { char: "新", hanViet: "tân", meaning: "mới, tươi mới, hiện đại, lần đầu", radical: "斤", radicalName: "bộ cân (斤)", components: ["亲", "斤"], componentMeanings: ["亲 (thân - thân cận)", "斤 (cân - cái rìu)"], strokeCount: 13, pinyin: "xīn" },
  "旧": { char: "旧", hanViet: "cựu", meaning: "cũ, cổ xưa, cũ kỹ, người cũ", radical: "一", radicalName: "bộ nhất (一)", components: ["旧"], componentMeanings: ["旧 (cựu - cũ)"], strokeCount: 5, pinyin: "jiù" },
  "美": { char: "美", hanViet: "mỹ", meaning: "đẹp, xinh đẹp, hoàn hảo, Mỹ (Hoa Kỳ)", radical: "羊", radicalName: "bộ dương (羊)", components: ["羊", "大"], componentMeanings: ["羊 (dương - con dê)", "大 (đại - lớn)"], strokeCount: 9, pinyin: "měi" },
  "东": { char: "东", hanViet: "đông", meaning: "đông, phương đông, chủ nhân", radical: "木", radicalName: "bộ mộc (木)", components: ["东"], componentMeanings: ["东 (đông - phía đông)"], strokeCount: 5, pinyin: "dōng" },
  "西": { char: "西", hanViet: "tây", meaning: "tây, phương tây", radical: "西", radicalName: "bộ tây (西)", components: ["西"], componentMeanings: ["西 (tây - phía tây)"], strokeCount: 6, pinyin: "xī" },
  "南": { char: "南", hanViet: "nam", meaning: "nam, phương nam", radical: "十", radicalName: "bộ thập (十)", components: ["南"], componentMeanings: ["南 (nam - phía nam)"], strokeCount: 9, pinyin: "nán" },
  "北": { char: "北", hanViet: "bắc", meaning: "bắc, phương bắc, phía bắc", radical: "匕", radicalName: "bộ bỉ (匕)", components: ["北"], componentMeanings: ["北 (bắc - phía bắc)"], strokeCount: 5, pinyin: "běi" },

  // Colors
  "白": { char: "白", hanViet: "bạch", meaning: "trắng, trắng tinh, rõ ràng, thú nhận", radical: "白", radicalName: "bộ bạch (白)", components: ["白"], componentMeanings: ["白 (bạch - trắng)"], strokeCount: 5, pinyin: "bái" },
  "黑": { char: "黑", hanViet: "hắc", meaning: "đen, đen tối, bí ẩn, xấu xa", radical: "黑", radicalName: "bộ hắc (黑)", components: ["里", "灬"], componentMeanings: ["里 (lý - trong)", "灬 (hỏa - lửa)"], strokeCount: 12, pinyin: "hēi" },
  "红": { char: "红", hanViet: "hồng", meaning: "đỏ, màu hồng, thành công, phổ biến", radical: "糸", radicalName: "bộ mịch (糸)", components: ["糸", "工"], componentMeanings: ["糸 (mịch - sợi tơ)", "工 (công - công việc)"], strokeCount: 6, pinyin: "hóng" },
  "黄": { char: "黄", hanViet: "hoàng", meaning: "vàng, màu vàng, hoàng đế", radical: "黄", radicalName: "bộ hoàng (黄)", components: ["黄"], componentMeanings: ["黄 (hoàng - vàng)"], strokeCount: 11, pinyin: "huáng" },
  "蓝": { char: "蓝", hanViet: "lam", meaning: "xanh lam, màu xanh da trời", radical: "艹", radicalName: "bộ thảo (艹)", components: ["艹", "监"], componentMeanings: ["艹 (thảo - cỏ)", "监 (giám - giám sát)"], strokeCount: 13, pinyin: "lán" },
  "绿": { char: "绿", hanViet: "lục", meaning: "xanh lục, màu xanh lá cây", radical: "糸", radicalName: "bộ mịch (糸)", components: ["糸", "彔"], componentMeanings: ["糸 (mịch - sợi tơ)", "彔 (lục - chép)"], strokeCount: 11, pinyin: "lǜ" },

  // Verbs / Actions
  "爱": { char: "爱", hanViet: "ái", meaning: "yêu, tình yêu, yêu thương, quý mến", radical: "心", radicalName: "bộ tâm (心)", components: ["爫", "冖", "心", "友"], componentMeanings: ["爫 (táo - móng vuốt)", "冖 (mịch - che phủ)", "心 (tâm - tim)", "友 (hữu - bạn)"], strokeCount: 10, pinyin: "ài" },
  "来": { char: "来", hanViet: "lai", meaning: "đến, đến nơi, tương lai, về sau", radical: "木", radicalName: "bộ mộc (木)", components: ["来"], componentMeanings: ["来 (lai - đến)"], strokeCount: 7, pinyin: "lái" },
  "去": { char: "去", hanViet: "khứ", meaning: "đi, rời đi, quá khứ, loại bỏ", radical: "厶", radicalName: "bộ tư (厶)", components: ["土", "厶"], componentMeanings: ["土 (thổ - đất)", "厶 (tư - riêng tư)"], strokeCount: 5, pinyin: "qù" },
  "学": { char: "学", hanViet: "học", meaning: "học, học hỏi, môn học, nhà trường", radical: "子", radicalName: "bộ tử (子)", components: ["学"], componentMeanings: ["学 (học - học)"], strokeCount: 8, pinyin: "xué" },
  "生": { char: "生", hanViet: "sinh", meaning: "sống, sinh ra, cuộc sống, học sinh", radical: "生", radicalName: "bộ sinh (生)", components: ["生"], componentMeanings: ["生 (sinh - sống)"], strokeCount: 5, pinyin: "shēng" },
  "看": { char: "看", hanViet: "khán", meaning: "xem, nhìn, trông chừng, thăm", radical: "目", radicalName: "bộ mục (目)", components: ["手", "目"], componentMeanings: ["手 (thủ - tay)", "目 (mục - mắt)"], strokeCount: 9, pinyin: "kàn/kān" },
  "听": { char: "听", hanViet: "thính", meaning: "nghe, lắng nghe, nghe lời", radical: "口", radicalName: "bộ khẩu (口)", components: ["口", "斤"], componentMeanings: ["口 (khẩu - miệng)", "斤 (cân - cái rìu)"], strokeCount: 7, pinyin: "tīng" },
  "说": { char: "说", hanViet: "thuyết", meaning: "nói, thuyết phục, giải thích, học thuyết", radical: "讠", radicalName: "bộ ngôn (讠)", components: ["讠", "兑"], componentMeanings: ["讠(ngôn - lời nói)", "兑 (đoái - vui vẻ)"], strokeCount: 9, pinyin: "shuō/shuì/yuè" },
  "写": { char: "写", hanViet: "tả", meaning: "viết, miêu tả, chép lại", radical: "冖", radicalName: "bộ mịch (冖)", components: ["冖", "与"], componentMeanings: ["冖 (mịch - che phủ)", "与 (dữ - cùng với)"], strokeCount: 5, pinyin: "xiě" },
  "读": { char: "读", hanViet: "độc", meaning: "đọc, học, nghiên cứu, đọc sách", radical: "讠", radicalName: "bộ ngôn (讠)", components: ["讠", "卖"], componentMeanings: ["讠(ngôn - lời nói)", "卖 (mại - bán)"], strokeCount: 10, pinyin: "dú/dòu" },
  "走": { char: "走", hanViet: "tẩu", meaning: "đi, chạy, rời đi, đi bộ", radical: "走", radicalName: "bộ tẩu (走)", components: ["走"], componentMeanings: ["走 (tẩu - đi)"], strokeCount: 7, pinyin: "zǒu" },
  "吃": { char: "吃", hanViet: "cật", meaning: "ăn, ăn uống, chịu đựng", radical: "口", radicalName: "bộ khẩu (口)", components: ["口", "乞"], componentMeanings: ["口 (khẩu - miệng)", "乞 (khất - xin)"], strokeCount: 6, pinyin: "chī" },
  "喝": { char: "喝", hanViet: "hát", meaning: "uống, hét lên, la hét", radical: "口", radicalName: "bộ khẩu (口)", components: ["口", "曷"], componentMeanings: ["口 (khẩu - miệng)", "曷 (hạt - tại sao)"], strokeCount: 12, pinyin: "hē/hè" },
  "睡": { char: "睡", hanViet: "thụy", meaning: "ngủ, giấc ngủ, nghỉ ngơi", radical: "目", radicalName: "bộ mục (目)", components: ["目", "垂"], componentMeanings: ["目 (mục - mắt)", "垂 (thùy - rủ xuống)"], strokeCount: 13, pinyin: "shuì" },
  "想": { char: "想", hanViet: "tưởng", meaning: "nghĩ, suy nghĩ, muốn, nhớ", radical: "心", radicalName: "bộ tâm (心)", components: ["相", "心"], componentMeanings: ["相 (tướng - hình dáng)", "心 (tâm - tim)"], strokeCount: 13, pinyin: "xiǎng" },
  "知": { char: "知", hanViet: "tri", meaning: "biết, hiểu biết, tri thức", radical: "矢", radicalName: "bộ thỉ (矢)", components: ["矢", "口"], componentMeanings: ["矢 (thỉ - mũi tên)", "口 (khẩu - miệng)"], strokeCount: 8, pinyin: "zhī/zhì" },

  // Places / Objects
  "家": { char: "家", hanViet: "gia", meaning: "nhà, gia đình, nơi ở, chuyên gia", radical: "宀", radicalName: "bộ miên (宀)", components: ["宀", "豕"], componentMeanings: ["宀 (miên - mái nhà)", "豕 (thỉ - con lợn)"], strokeCount: 10, pinyin: "jiā/gū" },
  "国": { char: "国", hanViet: "quốc", meaning: "nước, quốc gia, đất nước, vương quốc", radical: "囗", radicalName: "bộ vi (囗)", components: ["囗", "玉"], componentMeanings: ["囗 (vi - vây quanh)", "玉 (ngọc - ngọc bích)"], strokeCount: 8, pinyin: "guó" },
  "路": { char: "路", hanViet: "lộ", meaning: "đường, con đường, lộ trình, tuyến đường", radical: "足", radicalName: "bộ túc (足)", components: ["足", "各"], componentMeanings: ["足 (túc - chân)", "各 (các - mỗi)"], strokeCount: 13, pinyin: "lù" },
  "书": { char: "书", hanViet: "thư", meaning: "sách, thư, chữ viết, văn thư", radical: "乙", radicalName: "bộ ất (乙)", components: ["书"], componentMeanings: ["书 (thư - sách)"], strokeCount: 4, pinyin: "shū" },
  "字": { char: "字", hanViet: "tự", meaning: "chữ, ký tự, từ, tên chữ", radical: "宀", radicalName: "bộ miên (宀)", components: ["宀", "子"], componentMeanings: ["宀 (miên - mái nhà)", "子 (tử - đứa trẻ)"], strokeCount: 6, pinyin: "zì" },
  "文": { char: "文", hanViet: "văn", meaning: "văn chương, chữ, văn hóa, hoa văn", radical: "文", radicalName: "bộ văn (文)", components: ["文"], componentMeanings: ["文 (văn - văn chương)"], strokeCount: 4, pinyin: "wén" },
  "门": { char: "门", hanViet: "môn", meaning: "cửa, cổng, môn học, dòng họ", radical: "门", radicalName: "bộ môn (门)", components: ["门"], componentMeanings: ["门 (môn - cửa)"], strokeCount: 3, pinyin: "mén" },
  "车": { char: "车", hanViet: "xa", meaning: "xe, phương tiện di chuyển", radical: "车", radicalName: "bộ xa (车)", components: ["车"], componentMeanings: ["车 (xa - xe)"], strokeCount: 4, pinyin: "chē/jū" },
  "马": { char: "马", hanViet: "mã", meaning: "ngựa, mã, con mã (cờ vua)", radical: "马", radicalName: "bộ mã (马)", components: ["马"], componentMeanings: ["马 (mã - ngựa)"], strokeCount: 3, pinyin: "mǎ" },
  "花": { char: "花", hanViet: "hoa", meaning: "hoa, bông hoa, tiêu xài, hoa lệ", radical: "艹", radicalName: "bộ thảo (艹)", components: ["艹", "化"], componentMeanings: ["艹 (thảo - cỏ)", "化 (hóa - thay đổi)"], strokeCount: 7, pinyin: "huā" },
  "草": { char: "草", hanViet: "thảo", meaning: "cỏ, cỏ dại, sơ thảo, bản thảo", radical: "艹", radicalName: "bộ thảo (艹)", components: ["艹", "早"], componentMeanings: ["艹 (thảo - cỏ)", "早 (tảo - sớm)"], strokeCount: 9, pinyin: "cǎo" },
  "树": { char: "树", hanViet: "thụ", meaning: "cây, cây cối, trồng cây", radical: "木", radicalName: "bộ mộc (木)", components: ["木", "对", "寸"], componentMeanings: ["木 (mộc - gỗ)", "对 (đối - đối diện)", "寸 (thốn - tấc)"], strokeCount: 9, pinyin: "shù" },
  "鱼": { char: "鱼", hanViet: "ngư", meaning: "cá, loài cá", radical: "鱼", radicalName: "bộ ngư (鱼)", components: ["鱼"], componentMeanings: ["鱼 (ngư - cá)"], strokeCount: 8, pinyin: "yú" },

  // Time
  "年": { char: "年", hanViet: "niên", meaning: "năm, niên đại, tuổi tác", radical: "干", radicalName: "bộ can (干)", components: ["年"], componentMeanings: ["年 (niên - năm)"], strokeCount: 6, pinyin: "nián" },
  "时": { char: "时", hanViet: "thời", meaning: "thời gian, giờ, lúc, thời đại", radical: "日", radicalName: "bộ nhật (日)", components: ["日", "寸"], componentMeanings: ["日 (nhật - mặt trời)", "寸 (thốn - tấc)"], strokeCount: 7, pinyin: "shí" },
  "今": { char: "今", hanViet: "kim", meaning: "nay, hôm nay, hiện tại, đời này", radical: "人", radicalName: "bộ nhân (人)", components: ["亼", "一"], componentMeanings: ["亼 (tập - họp)", "一 (nhất - một)"], strokeCount: 4, pinyin: "jīn" },
  "古": { char: "古", hanViet: "cổ", meaning: "cổ đại, xưa, xưa cũ, truyền thống", radical: "口", radicalName: "bộ khẩu (口)", components: ["十", "口"], componentMeanings: ["十 (thập - mười)", "口 (khẩu - miệng)"], strokeCount: 5, pinyin: "gǔ" },

  // Philosophy / Culture
  "义": { char: "义", hanViet: "nghĩa", meaning: "nghĩa lý, ý nghĩa, đạo nghĩa, công bằng", radical: "义", radicalName: "bộ nghĩa (义)", components: ["义"], componentMeanings: ["义 (nghĩa - ý nghĩa)"], strokeCount: 3, pinyin: "yì" },
  "仁": { char: "仁", hanViet: "nhân", meaning: "nhân từ, lòng nhân, bác ái, hạt nhân", radical: "人", radicalName: "bộ nhân (人)", components: ["人", "二"], componentMeanings: ["人 (nhân - người)", "二 (nhị - hai)"], strokeCount: 4, pinyin: "rén" },
  "礼": { char: "礼", hanViet: "lễ", meaning: "lễ nghĩa, phép tắc, nghi lễ, quà tặng", radical: "礻", radicalName: "bộ kỳ (礻)", components: ["礻", "乙"], componentMeanings: ["礻(kỳ - thờ cúng)", "乙 (ất - thứ hai)"], strokeCount: 5, pinyin: "lǐ" },
  "智": { char: "智", hanViet: "trí", meaning: "trí tuệ, thông minh, sáng suốt, mưu lược", radical: "日", radicalName: "bộ nhật (日)", components: ["知", "日"], componentMeanings: ["知 (tri - biết)", "日 (nhật - mặt trời)"], strokeCount: 12, pinyin: "zhì" },
  "信": { char: "信", hanViet: "tín", meaning: "tin tưởng, chữ tín, thư, tín hiệu", radical: "人", radicalName: "bộ nhân (人)", components: ["人", "言"], componentMeanings: ["人 (nhân - người)", "言 (ngôn - lời nói)"], strokeCount: 9, pinyin: "xìn" },
  "和": { char: "和", hanViet: "hòa", meaning: "hòa bình, hài hòa, cùng với, hòa âm", radical: "口", radicalName: "bộ khẩu (口)", components: ["禾", "口"], componentMeanings: ["禾 (hòa - lúa)", "口 (khẩu - miệng)"], strokeCount: 8, pinyin: "hé/hè/huó/huò" },
  "平": { char: "平", hanViet: "bình", meaning: "bằng phẳng, bình thường, hòa bình, công bằng", radical: "干", radicalName: "bộ can (干)", components: ["平"], componentMeanings: ["平 (bình - bằng phẳng)"], strokeCount: 5, pinyin: "píng" },
  "道": { char: "道", hanViet: "đạo", meaning: "đạo, con đường, nguyên lý, nói", radical: "辶", radicalName: "bộ xước (辶)", components: ["辶", "首"], componentMeanings: ["辶 (xước - đi)", "首 (thủ - đầu)"], strokeCount: 12, pinyin: "dào" },
  "福": { char: "福", hanViet: "phúc", meaning: "phúc lộc, may mắn, hạnh phúc, phúc đức", radical: "礻", radicalName: "bộ kỳ (礻)", components: ["礻", "一", "口", "田"], componentMeanings: ["礻(kỳ - thờ cúng)", "一 (nhất)", "口 (khẩu)", "田 (điền - ruộng)"], strokeCount: 13, pinyin: "fú" },
  "寿": { char: "寿", hanViet: "thọ", meaning: "thọ, tuổi thọ, lâu dài, sống lâu", radical: "寸", radicalName: "bộ thốn (寸)", components: ["寿"], componentMeanings: ["寿 (thọ - thọ)"], strokeCount: 7, pinyin: "shòu" },
  "龙": { char: "龙", hanViet: "long", meaning: "rồng, hoàng đế, điều kỳ diệu", radical: "龙", radicalName: "bộ long (龙)", components: ["龙"], componentMeanings: ["龙 (long - rồng)"], strokeCount: 5, pinyin: "lóng" },

  // Common grammar words
  "不": { char: "不", hanViet: "bất", meaning: "không, bất, phủ định, chẳng", radical: "一", radicalName: "bộ nhất (一)", components: ["不"], componentMeanings: ["不 (bất - không)"], strokeCount: 4, pinyin: "bù/bú" },
  "有": { char: "有", hanViet: "hữu", meaning: "có, sở hữu, tồn tại, hữu ích", radical: "月", radicalName: "bộ nguyệt (月)", components: ["ナ", "月"], componentMeanings: ["ナ (phiên âm)", "月 (nguyệt - trăng)"], strokeCount: 6, pinyin: "yǒu" },
  "是": { char: "是", hanViet: "thị", meaning: "là, thị phi, phải, đúng", radical: "日", radicalName: "bộ nhật (日)", components: ["日", "正"], componentMeanings: ["日 (nhật - mặt trời)", "正 (chính - thẳng)"], strokeCount: 9, pinyin: "shì" },
  "在": { char: "在", hanViet: "tại", meaning: "ở, tồn tại, đang, có mặt", radical: "土", radicalName: "bộ thổ (土)", components: ["才", "土"], componentMeanings: ["才 (tài - tài năng)", "土 (thổ - đất)"], strokeCount: 6, pinyin: "zài" },

  // Compound-meaning characters (pedagogically interesting)
  "安": { char: "安", hanViet: "an", meaning: "an toàn, yên bình, bình an, yên tĩnh", radical: "宀", radicalName: "bộ miên (宀)", components: ["宀", "女"], componentMeanings: ["宀 (miên - mái nhà)", "女 (nữ - người nữ)"], strokeCount: 6, pinyin: "ān" },
  "林": { char: "林", hanViet: "lâm", meaning: "rừng cây, lâm nghiệp, họ Lâm", radical: "木", radicalName: "bộ mộc (木)", components: ["木", "木"], componentMeanings: ["木 (mộc - cây)", "木 (mộc - cây)"], strokeCount: 8, pinyin: "lín" },
  "森": { char: "森", hanViet: "sâm", meaning: "rừng rậm, tăm tối, nghiêm trang", radical: "木", radicalName: "bộ mộc (木)", components: ["木", "木", "木"], componentMeanings: ["木 (mộc - cây)", "木 (mộc - cây)", "木 (mộc - cây)"], strokeCount: 12, pinyin: "sēn" },
  "休": { char: "休", hanViet: "hưu", meaning: "nghỉ ngơi, hưu trí, thôi, dừng", radical: "人", radicalName: "bộ nhân (人)", components: ["人", "木"], componentMeanings: ["人 (nhân - người)", "木 (mộc - cây)"], strokeCount: 6, pinyin: "xiū" },
  "众": { char: "众", hanViet: "chúng", meaning: "đám đông, chúng sinh, nhiều người, công chúng", radical: "人", radicalName: "bộ nhân (人)", components: ["人", "人", "人"], componentMeanings: ["人 (nhân - người)", "人 (nhân - người)", "人 (nhân - người)"], strokeCount: 6, pinyin: "zhòng" },
  "品": { char: "品", hanViet: "phẩm", meaning: "phẩm chất, hàng hóa, loại, nếm thử", radical: "口", radicalName: "bộ khẩu (口)", components: ["口", "口", "口"], componentMeanings: ["口 (khẩu - miệng)", "口 (khẩu - miệng)", "口 (khẩu - miệng)"], strokeCount: 9, pinyin: "pǐn" },

  // Additional useful
  "光": { char: "光", hanViet: "quang", meaning: "ánh sáng, vinh quang, trần trụi, quang đãng", radical: "儿", radicalName: "bộ nhân (儿)", components: ["火", "儿"], componentMeanings: ["火 (hỏa - lửa)", "儿 (nhân - người)"], strokeCount: 6, pinyin: "guāng" },
  "力": { char: "力", hanViet: "lực", meaning: "sức mạnh, lực lượng, cố gắng hết sức", radical: "力", radicalName: "bộ lực (力)", components: ["力"], componentMeanings: ["力 (lực - sức mạnh)"], strokeCount: 2, pinyin: "lì" },
  "气": { char: "气", hanViet: "khí", meaning: "khí, không khí, hơi thở, tinh thần, tức giận", radical: "气", radicalName: "bộ khí (气)", components: ["气"], componentMeanings: ["气 (khí - không khí)"], strokeCount: 4, pinyin: "qì" },
  "名": { char: "名", hanViet: "danh", meaning: "tên, danh tiếng, nổi tiếng, danh hiệu", radical: "口", radicalName: "bộ khẩu (口)", components: ["夕", "口"], componentMeanings: ["夕 (tịch - ban tối)", "口 (khẩu - miệng)"], strokeCount: 6, pinyin: "míng" },
  "空": { char: "空", hanViet: "không", meaning: "trống rỗng, bầu trời, không gian, vắng lặng", radical: "穴", radicalName: "bộ huyệt (穴)", components: ["穴", "工"], componentMeanings: ["穴 (huyệt - cái hang)", "工 (công - công việc)"], strokeCount: 8, pinyin: "kōng/kòng" },
  "田": { char: "田", hanViet: "điền", meaning: "ruộng, cánh đồng, đất canh tác, đi săn", radical: "田", radicalName: "bộ điền (田)", components: ["田"], componentMeanings: ["田 (điền - ruộng)"], strokeCount: 5, pinyin: "tián" },
  "语": { char: "语", hanViet: "ngữ", meaning: "ngôn ngữ, tiếng nói, lời nói, thành ngữ", radical: "讠", radicalName: "bộ ngôn (讠)", components: ["讠", "吾"], componentMeanings: ["讠(ngôn - lời nói)", "吾 (ngô - ta)"], strokeCount: 9, pinyin: "yǔ/yù" },
};

export function searchCharacter(query: string): CharacterInfo | null {
  const char = query.trim();
  return HANTU_DATA[char] || null;
}

export function getAllCharacters(): CharacterInfo[] {
  return Object.values(HANTU_DATA);
}
