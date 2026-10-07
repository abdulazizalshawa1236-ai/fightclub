const D=require('better-sqlite3'),d=new D('data/club.db',{readonly:true});
const result={
 sections:d.prepare('select id,type,anchor,title,title_en,subtitle,subtitle_en,body,body_en,items,visible,position from sections order by position').all(),
 settings:d.prepare("select key,value from settings where key in ('phone','whatsapp','address','instagram','email','club_name')").all(),
 counts:{members:d.prepare('select count(*) c from members').get().c,admins:d.prepare('select count(*) c from admins').get().c,plans:d.prepare('select count(*) c from plans').get().c,classes:d.prepare('select count(*) c from classes').get().c}
}; console.log(JSON.stringify(result,null,2));
