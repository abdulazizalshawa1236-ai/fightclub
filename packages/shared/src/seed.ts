import type { PublicSite } from './index';
export const seedSite: PublicSite = {
  settings: {
    name: {
      ar: 'فايت كلوب',
      en: 'Fight Club',
    },
    tagline: {
      ar: 'نادي الفنون القتالية',
      en: 'Combat Sports Club',
    },
    phone: '0530335050',
    whatsapp: '0530335050',
    email: 'fightclubssaudi@gmail.com',
    address: {
      ar: 'حي المروج، الرياض، المملكة العربية السعودية',
      en: 'Al Muruj, Riyadh, Saudi Arabia',
    },
    hours: {
      ar: '',
      en: '',
    },
    mapUrl: '',
    instagram: 'https://www.instagram.com/fightclubksa/',
    warningDays: 3,
  },
  plans: [
    {
      id: 'plan-5',
      name: {
        ar: 'رياضة واحدة: 3 أشهر',
        en: 'One Sport: 3 Months',
      },
      price: 2199,
      oldPrice: null,
      currency: 'SAR',
      durationDays: 90,
      durationLabel: {
        ar: '/3 أشهر',
        en: '/3 months',
      },
      sportLimit: 1,
      benefits: [
        {
          ar: 'حصص رياضة واحدة',
          en: 'Classes in one sport',
        },
      ],
      featured: true,
      visible: true,
    },
    {
      id: 'plan-6',
      name: {
        ar: 'رياضة واحدة: 6 أشهر',
        en: 'One Sport: 6 Months',
      },
      price: 3710,
      oldPrice: null,
      currency: 'SAR',
      durationDays: 180,
      durationLabel: {
        ar: '/6 أشهر',
        en: '/6 months',
      },
      sportLimit: 1,
      benefits: [
        {
          ar: 'حصص رياضة واحدة',
          en: 'Classes in one sport',
        },
      ],
      featured: false,
      visible: true,
    },
    {
      id: 'plan-7',
      name: {
        ar: 'رياضة واحدة: سنة',
        en: 'One Sport: 1 Year',
      },
      price: 5999,
      oldPrice: null,
      currency: 'SAR',
      durationDays: 365,
      durationLabel: {
        ar: '/سنة',
        en: '/1 year',
      },
      sportLimit: 1,
      benefits: [
        {
          ar: 'حصص رياضة واحدة',
          en: 'Classes in one sport',
        },
      ],
      featured: false,
      visible: true,
    },
    {
      id: 'plan-8',
      name: {
        ar: 'رياضتان: 3 أشهر',
        en: 'Two Sports: 3 Months',
      },
      price: 3450,
      oldPrice: null,
      currency: 'SAR',
      durationDays: 90,
      durationLabel: {
        ar: '/3 أشهر',
        en: '/3 months',
      },
      sportLimit: 2,
      benefits: [
        {
          ar: 'حصص رياضتين',
          en: 'Classes in two sports',
        },
      ],
      featured: false,
      visible: true,
    },
    {
      id: 'plan-9',
      name: {
        ar: 'رياضتان: 6 أشهر',
        en: 'Two Sports: 6 Months',
      },
      price: 5790,
      oldPrice: null,
      currency: 'SAR',
      durationDays: 180,
      durationLabel: {
        ar: '/6 أشهر',
        en: '/6 months',
      },
      sportLimit: 2,
      benefits: [
        {
          ar: 'حصص رياضتين',
          en: 'Classes in two sports',
        },
      ],
      featured: false,
      visible: true,
    },
    {
      id: 'plan-10',
      name: {
        ar: 'رياضتان: سنة',
        en: 'Two Sports: 1 Year',
      },
      price: 8999,
      oldPrice: null,
      currency: 'SAR',
      durationDays: 365,
      durationLabel: {
        ar: '/سنة',
        en: '/1 year',
      },
      sportLimit: 2,
      benefits: [
        {
          ar: 'حصص رياضتين',
          en: 'Classes in two sports',
        },
      ],
      featured: false,
      visible: true,
    },
    {
      id: 'plan-11',
      name: {
        ar: 'VIP: 3 أشهر',
        en: 'VIP: 3 Months',
      },
      price: 4900,
      oldPrice: null,
      currency: 'SAR',
      durationDays: 90,
      durationLabel: {
        ar: '/3 أشهر',
        en: '/3 months',
      },
      sportLimit: null,
      benefits: [
        {
          ar: 'دخول جميع الحصص',
          en: 'Access to all classes',
        },
        {
          ar: 'جلستان تدريب شخصي شهرياً',
          en: 'Two personal training sessions monthly',
        },
      ],
      featured: false,
      visible: true,
    },
    {
      id: 'plan-12',
      name: {
        ar: 'VIP: 6 أشهر',
        en: 'VIP: 6 Months',
      },
      price: 7900,
      oldPrice: null,
      currency: 'SAR',
      durationDays: 180,
      durationLabel: {
        ar: '/6 أشهر',
        en: '/6 months',
      },
      sportLimit: null,
      benefits: [
        {
          ar: 'دخول جميع الحصص',
          en: 'Access to all classes',
        },
        {
          ar: 'جلستان تدريب شخصي شهرياً',
          en: 'Two personal training sessions monthly',
        },
      ],
      featured: false,
      visible: true,
    },
    {
      id: 'plan-13',
      name: {
        ar: 'VIP: سنة',
        en: 'VIP: 1 Year',
      },
      price: 12999,
      oldPrice: null,
      currency: 'SAR',
      durationDays: 365,
      durationLabel: {
        ar: '/سنة',
        en: '/1 year',
      },
      sportLimit: null,
      benefits: [
        {
          ar: 'دخول جميع الحصص',
          en: 'Access to all classes',
        },
        {
          ar: 'جلستان تدريب شخصي شهرياً',
          en: 'Two personal training sessions monthly',
        },
      ],
      featured: false,
      visible: true,
    },
  ],
  sports: [
    {
      id: 'boxing',
      name: {
        ar: 'الملاكمة',
        en: 'Boxing',
      },
      description: {
        ar: 'حصص ملاكمة منظمة وآمنة تطور اللياقة والتحمل والتركيز والثقة، وتناسب مستويات مختلفة.',
        en: 'Structured boxing classes build fitness, endurance, focus and confidence for different levels.',
      },
      available: true,
    },
    {
      id: 'muay-thai',
      name: {
        ar: 'مواي تاي',
        en: 'Muay Thai',
      },
      description: {
        ar: 'تدريب على الركلات واللكمات والركب والمرفقين، مع التركيز على القوة والتوازن والانضباط.',
        en: 'Train punches, kicks, knees and elbows while developing strength, balance and discipline.',
      },
      available: true,
    },
    {
      id: 'taekwondo',
      name: {
        ar: 'تايكوندو',
        en: 'Taekwondo',
      },
      description: {
        ar: 'طوّر سرعتك ومرونتك وتقنيات الركل.',
        en: 'Develop speed, flexibility and kicking technique.',
      },
      available: true,
    },
    {
      id: 'jiu-jitsu',
      name: {
        ar: 'جوجيتسو',
        en: 'Jiu-Jitsu',
      },
      description: {
        ar: 'طوّر التحكم والهدوء وحل المشكلات تحت الضغط، مع حصص مناسبة للمبتدئين.',
        en: 'Build control, composure and problem-solving under pressure, with classes suitable for beginners.',
      },
      available: true,
    },
    {
      id: 'wrestling',
      name: {
        ar: 'مصارعة',
        en: 'Wrestling',
      },
      description: {
        ar: 'قوّة وتوازن وإسقاطات تحت إشراف المدرب.',
        en: 'Build strength, balance and takedowns with a coach.',
      },
      available: true,
    },
    {
      id: 'mma',
      name: {
        ar: 'الفنون القتالية المختلطة MMA',
        en: 'Mixed Martial Arts (MMA)',
      },
      description: {
        ar: 'تدريب منظم يجمع أساليب قتالية متعددة ويطوّر اللياقة والتحمل.',
        en: 'Structured training that combines multiple martial arts and builds fitness and endurance.',
      },
      available: true,
    },
    {
      id: 'fitness',
      name: {
        ar: 'اللياقة والقوة',
        en: 'Strength & Fitness',
      },
      description: {
        ar: 'مساحة متكاملة لتطوير القوة واللياقة بإشراف المدربين.',
        en: 'A dedicated space to improve strength and fitness with coach guidance.',
      },
      available: true,
    },
  ],
  coaches: [
    {
      id: 'firas-saadah',
      name: {
        ar: 'فراس سعدة',
        en: 'Firas Saadah',
      },
      bio: {
        ar: 'مدرب المنتخب السعودي للمواي تاي. يمتلك خبرة عالية في تأسيس اللاعبين وتطويرهم لمختلف المستويات.',
        en: 'Muay Thai coach for the Saudi national team, with extensive experience developing athletes at different levels.',
      },
      image: '/assets/trainers/firas-saadah.jpg',
      sports: [],
    },
    {
      id: 'jose-maria-tomy',
      name: {
        ar: 'جوزيه ماريا تومي',
        en: 'Jose Maria Tomy',
      },
      bio: {
        ar: 'مدرب MMA وحاصل على الحزام الأسود في الجوجيتسو، ومقاتل سابق في UFC. شارك ضمن الطاقم التدريبي لإسلام ماخاشيف.',
        en: 'MMA coach, Brazilian Jiu-Jitsu black belt and former UFC fighter. Has worked on the coaching team of Islam Makhachev.',
      },
      image: '/assets/trainers/jose-maria-tomy.jpg',
      sports: [],
    },
    {
      id: 'abdullah-jawish',
      name: {
        ar: 'عبدالله جاويش',
        en: 'Abdullah Jawish',
      },
      bio: {
        ar: 'مدرب جوجيتسو وحاصل على الحزام الأسود. بطل عالم 18 مرة، ويتميز بخبرته في تدريب الأطفال والكبار.',
        en: 'Jiu-Jitsu coach and black belt, described in the club brochure as an 18-time world champion, with experience coaching children and adults.',
      },
      image: '/assets/trainers/abdullah-jawish.jpg',
      sports: [],
    },
    {
      id: 'soufiane-zridy',
      name: {
        ar: 'سفيان الزريدي',
        en: 'Soufiane Zridy',
      },
      bio: {
        ar: 'مدرب مواي تاي وبطل عالم سبع مرات، متخصص في تأسيس اللاعبين والتطوير الفني والبدني.',
        en: 'Muay Thai coach and seven-time world champion, specializing in athlete development and technical and physical training.',
      },
      image: '/assets/trainers/soufiane-zridy.jpg',
      sports: [],
    },
    {
      id: 'roua-salim',
      name: {
        ar: 'رؤى سليم',
        en: 'Roua Salim',
      },
      bio: {
        ar: 'مدربة سابقة للمنتخب الأردني وحكم دولي في التايكوندو، ولديها خبرة في تأسيس الأطفال وتطويرهم.',
        en: 'Former Jordanian national team coach and international Taekwondo referee, with experience developing young athletes.',
      },
      image: '/assets/trainers/roua-salim.jpg',
      sports: [],
    },
    {
      id: 'adel-bek',
      name: {
        ar: 'عادل بيك',
        en: 'Adel Bek',
      },
      bio: {
        ar: 'مدرب ملاكمة أولمبي من أوزبكستان، يقدم أسلوب المدرسة السوفيتية للمبتدئين والمحترفين.',
        en: 'Olympic boxing coach from Uzbekistan, bringing the Soviet-school approach to beginner and professional athletes.',
      },
      image: '/assets/trainers/adel-bek.jpg',
      sports: [],
    },
    {
      id: 'abdelkarim-zridy',
      name: {
        ar: 'عبدالكريم الزريدي',
        en: 'Abdelkarim Zridy',
      },
      bio: {
        ar: 'مدرب ملاكمة في الرياض. تشمل إنجازاته ألقاباً في المغرب والسعودية، وبطولة أفضل لاعب 2017، ومركز الوصافة في دورة الألعاب السعودية 2023 بوزني 60 و63 كجم.',
        en: 'Boxing coach in Riyadh. His listed achievements include Moroccan and Saudi titles, the 2017 Best Player Cup and second place at the 2023 Saudi Games in the 60 kg and 63 kg divisions.',
      },
      image: '/assets/trainers/abdelkarim-zridy.jpg',
      sports: [],
    },
  ],
  offers: [],
  blocks: [
    {
      id: 'home',
      type: 'hero',
      title: {
        ar: 'قاتل بقوة، وتدرّب بانضباط',
        en: 'Train hard. Fight with discipline.',
      },
      body: {
        ar: 'ملاكمة · مواي تاي · تايكوندو · جوجيتسو · مصارعة: برامج للصغار والكبار.',
        en: 'Boxing · Muay Thai · Taekwondo · Jiu-Jitsu · Wrestling: classes for children and adults.',
      },
      visible: true,
      position: 0,
      items: [],
    },
    {
      id: 'about',
      type: 'about',
      title: {
        ar: 'من نحن',
        en: 'Who we are',
      },
      body: {
        ar: 'تأسس فايت كلوب في الرياض عام 2016 ليقدم تدريباً متخصصاً في الفنون القتالية واللياقة البدنية. نهيئ حصصاً تناسب الأطفال والكبار، من المبتدئين إلى المتقدمين، في بيئة منظمة تشجع على الانضباط والاحترام والتطور.\n\nرسالتنا أن نمنح كل متدرب بداية صحيحة وفرصة حقيقية للتطور وتحقيق أهدافه، سواء كانت تحسين اللياقة، تعلم مهارة جديدة أو الاستعداد للمنافسة.',
        en: 'Fight Club was founded in Riyadh in 2016 to provide focused martial arts and fitness training. Our classes are designed for children and adults, from beginners to advanced athletes, in an organized environment built on discipline, respect and progress.\n\nOur mission is to give every member a strong start and a real opportunity to reach their goals, whether that means improving fitness, learning a new skill or preparing to compete.',
      },
      visible: true,
      position: 1,
      items: [],
    },
    {
      id: 'programs',
      type: 'programs',
      title: {
        ar: 'اختر رياضتك',
        en: 'Choose your discipline',
      },
      body: {
        ar: 'من الرياضات القتالية إلى اللياقة والقوة: برامج تناسب أهدافك ومستواك',
        en: 'From combat sports to strength and fitness: programs for your goals and level',
      },
      visible: true,
      position: 2,
      items: [
        {
          title: {
            ar: 'الملاكمة',
            en: 'Boxing',
          },
          body: {
            ar: 'حصص ملاكمة منظمة وآمنة تطور اللياقة والتحمل والتركيز والثقة، وتناسب مستويات مختلفة.',
            en: 'Structured boxing classes build fitness, endurance, focus and confidence for different levels.',
          },
        },
        {
          title: {
            ar: 'مواي تاي',
            en: 'Muay Thai',
          },
          body: {
            ar: 'تدريب على الركلات واللكمات والركب والمرفقين، مع التركيز على القوة والتوازن والانضباط.',
            en: 'Train punches, kicks, knees and elbows while developing strength, balance and discipline.',
          },
        },
        {
          title: {
            ar: 'تايكوندو',
            en: 'Taekwondo',
          },
          body: {
            ar: 'طوّر سرعتك ومرونتك وتقنيات الركل.',
            en: 'Develop speed, flexibility and kicking technique.',
          },
        },
        {
          title: {
            ar: 'جوجيتسو',
            en: 'Jiu-Jitsu',
          },
          body: {
            ar: 'طوّر التحكم والهدوء وحل المشكلات تحت الضغط، مع حصص مناسبة للمبتدئين.',
            en: 'Build control, composure and problem-solving under pressure, with classes suitable for beginners.',
          },
        },
        {
          title: {
            ar: 'مصارعة',
            en: 'Wrestling',
          },
          body: {
            ar: 'قوّة وتوازن وإسقاطات تحت إشراف المدرب.',
            en: 'Build strength, balance and takedowns with a coach.',
          },
        },
        {
          title: {
            ar: 'الفنون القتالية المختلطة MMA',
            en: 'Mixed Martial Arts (MMA)',
          },
          body: {
            ar: 'تدريب منظم يجمع أساليب قتالية متعددة ويطوّر اللياقة والتحمل.',
            en: 'Structured training that combines multiple martial arts and builds fitness and endurance.',
          },
        },
        {
          title: {
            ar: 'اللياقة والقوة',
            en: 'Strength & Fitness',
          },
          body: {
            ar: 'مساحة متكاملة لتطوير القوة واللياقة بإشراف المدربين.',
            en: 'A dedicated space to improve strength and fitness with coach guidance.',
          },
        },
      ],
    },
    {
      id: 'pricing',
      type: 'plans',
      title: {
        ar: 'باقات الاشتراك',
        en: 'Membership plans',
      },
      body: {
        ar: 'اختر المدة المناسبة وابدأ اليوم',
        en: 'Choose a plan and get started today',
      },
      visible: true,
      position: 3,
      items: [],
    },
    {
      id: 'offers',
      type: 'offers',
      title: {
        ar: 'العروض الحالية',
        en: 'Current offers',
      },
      body: {
        ar: 'فرص محدودة: لا تفوّتها',
        en: 'Limited-time offers: do not miss out',
      },
      visible: true,
      position: 4,
      items: [],
    },
    {
      id: 'schedule',
      type: 'schedule',
      title: {
        ar: 'جدول الحصص',
        en: 'Class schedule',
      },
      body: {
        ar: 'حصص للصغار والكبار من السبت إلى الخميس: اختر يوماً لعرض المواعيد',
        en: 'Classes for children and adults, Saturday through Thursday. Choose a day to see the times.',
      },
      visible: true,
      position: 5,
      items: [],
    },
    {
      id: 'coaches',
      type: 'coaches',
      title: {
        ar: 'نخبة المدربين',
        en: 'Meet our coaches',
      },
      body: {
        ar: 'خبرات في الملاكمة، المواي تاي، الجوجيتسو، التايكوندو والفنون القتالية المختلطة.',
        en: 'Experienced coaches in boxing, Muay Thai, Jiu-Jitsu, Taekwondo and mixed martial arts.',
      },
      visible: true,
      position: 6,
      items: [
        {
          title: {
            ar: 'فراس سعدة',
            en: 'Firas Saadah',
          },
          body: {
            ar: 'مدرب المنتخب السعودي للمواي تاي. يمتلك خبرة عالية في تأسيس اللاعبين وتطويرهم لمختلف المستويات.',
            en: 'Muay Thai coach for the Saudi national team, with extensive experience developing athletes at different levels.',
          },
          image: '/assets/trainers/firas-saadah.jpg',
        },
        {
          title: {
            ar: 'جوزيه ماريا تومي',
            en: 'Jose Maria Tomy',
          },
          body: {
            ar: 'مدرب MMA وحاصل على الحزام الأسود في الجوجيتسو، ومقاتل سابق في UFC. شارك ضمن الطاقم التدريبي لإسلام ماخاشيف.',
            en: 'MMA coach, Brazilian Jiu-Jitsu black belt and former UFC fighter. Has worked on the coaching team of Islam Makhachev.',
          },
          image: '/assets/trainers/jose-maria-tomy.jpg',
        },
        {
          title: {
            ar: 'عبدالله جاويش',
            en: 'Abdullah Jawish',
          },
          body: {
            ar: 'مدرب جوجيتسو وحاصل على الحزام الأسود. بطل عالم 18 مرة، ويتميز بخبرته في تدريب الأطفال والكبار.',
            en: 'Jiu-Jitsu coach and black belt, described in the club brochure as an 18-time world champion, with experience coaching children and adults.',
          },
          image: '/assets/trainers/abdullah-jawish.jpg',
        },
        {
          title: {
            ar: 'سفيان الزريدي',
            en: 'Soufiane Zridy',
          },
          body: {
            ar: 'مدرب مواي تاي وبطل عالم سبع مرات، متخصص في تأسيس اللاعبين والتطوير الفني والبدني.',
            en: 'Muay Thai coach and seven-time world champion, specializing in athlete development and technical and physical training.',
          },
          image: '/assets/trainers/soufiane-zridy.jpg',
        },
        {
          title: {
            ar: 'رؤى سليم',
            en: 'Roua Salim',
          },
          body: {
            ar: 'مدربة سابقة للمنتخب الأردني وحكم دولي في التايكوندو، ولديها خبرة في تأسيس الأطفال وتطويرهم.',
            en: 'Former Jordanian national team coach and international Taekwondo referee, with experience developing young athletes.',
          },
          image: '/assets/trainers/roua-salim.jpg',
        },
        {
          title: {
            ar: 'عادل بيك',
            en: 'Adel Bek',
          },
          body: {
            ar: 'مدرب ملاكمة أولمبي من أوزبكستان، يقدم أسلوب المدرسة السوفيتية للمبتدئين والمحترفين.',
            en: 'Olympic boxing coach from Uzbekistan, bringing the Soviet-school approach to beginner and professional athletes.',
          },
          image: '/assets/trainers/adel-bek.jpg',
        },
        {
          title: {
            ar: 'عبدالكريم الزريدي',
            en: 'Abdelkarim Zridy',
          },
          body: {
            ar: 'مدرب ملاكمة في الرياض. تشمل إنجازاته ألقاباً في المغرب والسعودية، وبطولة أفضل لاعب 2017، ومركز الوصافة في دورة الألعاب السعودية 2023 بوزني 60 و63 كجم.',
            en: 'Boxing coach in Riyadh. His listed achievements include Moroccan and Saudi titles, the 2017 Best Player Cup and second place at the 2023 Saudi Games in the 60 kg and 63 kg divisions.',
          },
          image: '/assets/trainers/abdelkarim-zridy.jpg',
        },
      ],
    },
    {
      id: 'corporate-programs',
      type: 'corporate',
      title: {
        ar: 'برامج الشركات والجهات',
        en: 'Corporate & group programs',
      },
      body: {
        ar: 'تجارب رياضية مخصصة للشركات والفرق وفق أهدافها وأوقاتها.',
        en: 'Tailored sports experiences for companies and teams, built around their goals and schedules.',
      },
      visible: true,
      position: 7,
      items: [
        {
          title: {
            ar: 'حصص جماعية للفريق',
            en: 'Group classes for teams',
          },
          body: {
            ar: 'حصص جماعية تبني اللياقة وروح الفريق في بيئة تدريبية منظمة.',
            en: 'Group sessions that build fitness and team spirit in an organized training environment.',
          },
        },
        {
          title: {
            ar: 'تجارب تعريفية بالفنون القتالية',
            en: 'Introductory combat-sports sessions',
          },
          body: {
            ar: 'تجارب مناسبة للجهات التي ترغب بتعريف موظفيها بالفنون القتالية.',
            en: 'An introduction for organizations that want their teams to try combat sports.',
          },
        },
        {
          title: {
            ar: 'برامج اللياقة والقوة',
            en: 'Fitness and strength programs',
          },
          body: {
            ar: 'برامج تساعد الموظفين على النشاط البدني وكسر الروتين.',
            en: 'Programs that encourage physical activity and help teams break their routine.',
          },
        },
        {
          title: {
            ar: 'جدولة مخصصة للجهات',
            en: 'Scheduling tailored to each organization',
          },
          body: {
            ar: 'يمكن تخصيص الأوقات والبرنامج وفق عدد المشاركين وأهداف الجهة.',
            en: 'Times and programs can be tailored to the group size and organization’s goals.',
          },
        },
      ],
    },
    {
      id: 'faq',
      type: 'faq',
      title: {
        ar: 'أسئلة شائعة',
        en: 'Frequently asked questions',
      },
      body: {
        ar: '',
        en: '',
      },
      visible: true,
      position: 8,
      items: [
        {
          title: {
            ar: 'كيف أسجّل دخولي لحسابي؟',
            en: 'How do I sign in?',
          },
          body: {
            ar: 'من زر «دخول المشتركين» باستخدام رقم الهوية أو الإقامة ورقم الجوال المسجّل لدى النادي.',
            en: 'Use the national ID or residency number and the mobile number registered with the club.',
          },
        },
        {
          title: {
            ar: 'كيف أعرف متى ينتهي اشتراكي؟',
            en: 'How can I check when my membership ends?',
          },
          body: {
            ar: 'تظهر حالة اشتراكك وعدد الأيام المتبقية داخل حسابك، وسنرسل لك تنبيهاً عند قرب الانتهاء وعند انتهائه.',
            en: 'Your membership status and remaining days appear in your account. You will also see a reminder when it is close to expiring or has expired.',
          },
        },
        {
          title: {
            ar: 'كيف أجدّد اشتراكي؟',
            en: 'How do I renew?',
          },
          body: {
            ar: 'تواصل معنا عبر واتساب أو زر النادي، وسيتم تجديد الاشتراك وتحديث حسابك مباشرة.',
            en: 'Contact us on WhatsApp or call the club, and we will update your membership.',
          },
        },
        {
          title: {
            ar: 'أين أجد مواعيد الحصص؟',
            en: 'Where can I find class times?',
          },
          body: {
            ar: 'في قسم «جدول الحصص» اختر اليوم لتظهر لك الحصص والمدربين.',
            en: 'Choose a day in the Class Schedule section to view classes and coaches.',
          },
        },
      ],
    },
    {
      id: 'contact',
      type: 'contact',
      title: {
        ar: 'تواصل معنا',
        en: 'Contact us',
      },
      body: {
        ar: 'يسعدنا استقبالك',
        en: 'We would be glad to hear from you',
      },
      visible: true,
      position: 9,
      items: [],
    },
  ],
  revision: 1,
};
