from pathlib import Path
p=Path('src/db.js'); s=p.read_text(encoding='utf-8')
marker='\nmodule.exports = { db, DATA_DIR, getSettings, SETTING_KEYS, DEFAULT_SETTINGS };'
if s.count(marker)!=1: raise SystemExit('module export marker mismatch')
migration=r'''

applyMigration('fightclub-coaches-business-2026-10', () => {
  const about = db.prepare("SELECT id FROM sections WHERE anchor='about'").get();
  if (about) db.prepare('UPDATE sections SET subtitle=?,subtitle_en=?,body=?,body_en=? WHERE id=?').run(
    'تأسس فايت كلوب في الرياض عام 2016، ويقدّم تدريباً متخصصاً في الفنون القتالية واللياقة البدنية للأطفال والكبار، من المبتدئين إلى المتقدمين.',
    'Founded in Riyadh in 2016, Fight Club offers focused martial arts and fitness training for children and adults, from beginners to advanced athletes.',
    'تأسس فايت كلوب في الرياض عام 2016 ليقدم تدريباً متخصصاً في الفنون القتالية واللياقة البدنية. نهيئ حصصاً تناسب الأطفال والكبار، من المبتدئين إلى المتقدمين، في بيئة منظمة تشجع على الانضباط والاحترام والتطور.\\n\\nرسالتنا أن نمنح كل متدرب بداية صحيحة وفرصة حقيقية للتطور وتحقيق أهدافه، سواء كانت تحسين اللياقة، تعلم مهارة جديدة أو الاستعداد للمنافسة.',
    'Fight Club was founded in Riyadh in 2016 to provide focused martial arts and fitness training. Our classes are designed for children and adults, from beginners to advanced athletes, in an organized environment built on discipline, respect and progress.\\n\\nOur mission is to give every member a strong start and a real opportunity to reach their goals, whether that means improving fitness, learning a new skill or preparing to compete.', about.id);

  const programs = db.prepare("SELECT id,items FROM sections WHERE anchor='programs'").get();
  if (programs) {
    let items = [];
    try { items = JSON.parse(programs.items || '[]'); } catch (_) { items = []; }
    const titles = ['الملاكمة', 'مواي تاي', 'تايكوندو', 'جوجيتسو', 'مصارعة'];
    if (items.length === 5 && items.every((x, i) => x.title === titles[i])) {
      items[0].text = 'حصص ملاكمة منظمة وآمنة تطور اللياقة والتحمل والتركيز والثقة، وتناسب مستويات مختلفة.';
      items[0].text_en = 'Structured boxing classes build fitness, endurance, focus and confidence for different levels.';
      items[1].text = 'تدريب على الركلات واللكمات والركب والمرفقين، مع التركيز على القوة والتوازن والانضباط.';
      items[1].text_en = 'Train punches, kicks, knees and elbows while developing strength, balance and discipline.';
      items[3].text = 'طوّر التحكم والهدوء وحل المشكلات تحت الضغط، مع حصص مناسبة للمبتدئين.';
      items[3].text_en = 'Build control, composure and problem-solving under pressure, with classes suitable for beginners.';
      items.push(
        { icon: 'shield', title: 'الفنون القتالية المختلطة MMA', title_en: 'Mixed Martial Arts (MMA)', text: 'تدريب منظم يجمع أساليب قتالية متعددة ويطوّر اللياقة والتحمل.', text_en: 'Structured training that combines multiple martial arts and builds fitness and endurance.' },
        { icon: 'flame', title: 'اللياقة والقوة', title_en: 'Strength & Fitness', text: 'مساحة متكاملة لتطوير القوة واللياقة بإشراف المدربين.', text_en: 'A dedicated space to improve strength and fitness with coach guidance.' }
      );
      db.prepare('UPDATE sections SET subtitle=?,subtitle_en=?,items=? WHERE id=?').run(
        'من الرياضات القتالية إلى اللياقة والقوة — برامج تناسب أهدافك ومستواك',
        'From combat sports to strength and fitness — programs for your goals and level', JSON.stringify(items), programs.id);
    }
  }

  const coaches = [
    { title: 'فراس سعدة', title_en: 'Firas Saadah', text: 'مدرب المنتخب السعودي للمواي تاي. يمتلك خبرة عالية في تأسيس اللاعبين وتطويرهم لمختلف المستويات.', text_en: 'Muay Thai coach for the Saudi national team, with extensive experience developing athletes at different levels.', image: '/assets/trainers/firas-saadah.jpg' },
    { title: 'جوزيه ماريا تومي', title_en: 'Jose Maria Tomy', text: 'مدرب MMA وحاصل على الحزام الأسود في الجوجيتسو، ومقاتل سابق في UFC. شارك ضمن الطاقم التدريبي لإسلام ماخاشيف.', text_en: 'MMA coach, Brazilian Jiu-Jitsu black belt and former UFC fighter. Has worked on the coaching team of Islam Makhachev.', image: '/assets/trainers/jose-maria-tomy.jpg' },
    { title: 'عبدالله جاويش', title_en: 'Abdullah Jawish', text: 'مدرب جوجيتسو وحاصل على الحزام الأسود. بطل عالم 18 مرة، ويتميز بخبرته في تدريب الأطفال والكبار.', text_en: 'Jiu-Jitsu coach and black belt, described in the club brochure as an 18-time world champion, with experience coaching children and adults.', image: '/assets/trainers/abdullah-jawish.jpg' },
    { title: 'سفيان الزريدي', title_en: 'Soufiane Zridy', text: 'مدرب مواي تاي وبطل عالم سبع مرات، متخصص في تأسيس اللاعبين والتطوير الفني والبدني.', text_en: 'Muay Thai coach and seven-time world champion, specializing in athlete development and technical and physical training.', image: '/assets/trainers/soufiane-zridy.jpg' },
    { title: 'رؤى سليم', title_en: 'Roua Salim', text: 'مدربة سابقة للمنتخب الأردني وحكم دولي في التايكوندو، ولديها خبرة في تأسيس الأطفال وتطويرهم.', text_en: 'Former Jordanian national team coach and international Taekwondo referee, with experience developing young athletes.', image: '/assets/trainers/roua-salim.jpg' },
    { title: 'عادل بيك', title_en: 'Adel Bek', text: 'مدرب ملاكمة أولمبي من أوزبكستان، يقدم أسلوب المدرسة السوفيتية للمبتدئين والمحترفين.', text_en: 'Olympic boxing coach from Uzbekistan, bringing the Soviet-school approach to beginner and professional athletes.', image: '/assets/trainers/adel-bek.jpg' },
    { title: 'عبدالكريم الزريدي', title_en: 'Abdelkarim Zridy', text: 'مدرب ملاكمة في الرياض. تشمل إنجازاته ألقاباً في المغرب والسعودية، وبطولة أفضل لاعب 2017، ومركز الوصافة في دورة الألعاب السعودية 2023 بوزني 60 و63 كجم.', text_en: 'Boxing coach in Riyadh. His listed achievements include Moroccan and Saudi titles, the 2017 Best Player Cup and second place at the 2023 Saudi Games in the 60 kg and 63 kg divisions.', image: '/assets/trainers/abdelkarim-zridy.jpg', phone: '0551796505', email: 'zroud63.5@gmail.com' },
  ];
  const companies = [
    { icon: 'users', title: 'حصص جماعية للفريق', title_en: 'Group classes for teams', text: 'حصص جماعية تبني اللياقة وروح الفريق في بيئة تدريبية منظمة.', text_en: 'Group sessions that build fitness and team spirit in an organized training environment.' },
    { icon: 'glove', title: 'تجارب تعريفية بالفنون القتالية', title_en: 'Introductory combat-sports sessions', text: 'تجارب مناسبة للجهات التي ترغب بتعريف موظفيها بالفنون القتالية.', text_en: 'An introduction for organizations that want their teams to try combat sports.' },
    { icon: 'flame', title: 'برامج اللياقة والقوة', title_en: 'Fitness and strength programs', text: 'برامج تساعد الموظفين على النشاط البدني وكسر الروتين.', text_en: 'Programs that encourage physical activity and help teams break their routine.' },
    { icon: 'calendar', title: 'جدولة مخصصة للجهات', title_en: 'Scheduling tailored to each organization', text: 'يمكن تخصيص الأوقات والبرنامج وفق عدد المشاركين وأهداف الجهة.', text_en: 'Times and programs can be tailored to the group size and organization’s goals.' },
  ];
  const upsertSection = (section, position) => {
    const found = db.prepare('SELECT id FROM sections WHERE anchor=?').get(section.anchor);
    if (found) return;
    db.prepare(`INSERT INTO sections(type,anchor,nav_label,nav_label_en,title,title_en,subtitle,subtitle_en,body,body_en,items,position,visible)
      VALUES('cards',?,?,?,?,?,?,?,?,?,?,?,1)`).run(section.anchor, section.nav_label, section.nav_label_en, section.title,
        section.title_en, section.subtitle, section.subtitle_en, '', '', JSON.stringify(section.items), position);
  };
  upsertSection({ anchor: 'coaches', nav_label: 'المدربون', nav_label_en: 'Coaches', title: 'نخبة المدربين', title_en: 'Meet our coaches',
    subtitle: 'خبرات في الملاكمة، المواي تاي، الجوجيتسو، التايكوندو والفنون القتالية المختلطة.',
    subtitle_en: 'Experienced coaches in boxing, Muay Thai, Jiu-Jitsu, Taekwondo and mixed martial arts.', items: coaches }, 6);
  upsertSection({ anchor: 'corporate-programs', nav_label: 'للشركات', nav_label_en: 'For organizations', title: 'برامج الشركات والجهات', title_en: 'Corporate & group programs',
    subtitle: 'تجارب رياضية مخصصة للشركات والفرق وفق أهدافها وأوقاتها.',
    subtitle_en: 'Tailored sports experiences for companies and teams, built around their goals and schedules.', items: companies }, 7);
  db.prepare("UPDATE sections SET position=8 WHERE anchor='faq'").run();
  db.prepare("UPDATE sections SET position=9 WHERE anchor='contact'").run();
  db.prepare("UPDATE settings SET value='حي المروج، الرياض، المملكة العربية السعودية' WHERE key='address' AND value=''").run();
  db.prepare("UPDATE settings SET value='Al Muruj, Riyadh, Saudi Arabia' WHERE key='address_en' AND value=''").run();
  db.prepare("UPDATE settings SET value='https://www.instagram.com/fightclubksa/' WHERE key='instagram' AND value=''").run();
});
'''
p.write_text(s.replace(marker,migration+marker),encoding='utf-8')
