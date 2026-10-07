from pathlib import Path
from PIL import Image
pdf_img=Image.open(Path('work/pdf-review/poster-06.png')).convert('RGB')
print('poster6',pdf_img.size)
source=Image.open(Path(r'C:\Users\abdul\OneDrive\Desktop\5e5651f0-d53d-4e3f-b263-c96eb0540af6.jpg')).convert('RGB')
print('cv',source.size)
# poster page six displays its six portraits in a two-row grid; preserve them as supplied.
boxes={
 'firas-saadah.jpg':(68,650,268,838),
 'jose-maria-tomy.jpg':(279,650,490,838),
 'abdullah-jawish.jpg':(504,650,731,838),
 'soufiane-zridy.jpg':(68,846,268,1055),
 'roua-salim.jpg':(279,846,490,1055),
 'adel-bek.jpg':(504,846,731,1055),
}
for name,box in boxes.items():
    img=pdf_img.crop(box)
    img.thumbnail((700,700),Image.Resampling.LANCZOS)
    img.save(Path('public/assets/trainers')/name,quality=88,optimize=True)
# Crop the supplied coach portrait from the CV image, excluding the text and divider.
portrait=source.crop((393,15,520,197))
portrait.thumbnail((700,700),Image.Resampling.LANCZOS)
portrait.save(Path('public/assets/trainers/abdelkarim-zridy.jpg'),quality=90,optimize=True)
