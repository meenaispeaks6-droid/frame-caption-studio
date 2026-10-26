from PIL import Image,ImageDraw,ImageFilter
import math,random
random.seed(17)
w,h=900,1600
im=Image.new('RGB',(w,h));p=im.load()
for y in range(h):
 t=y/h
 for x in range(w):
  glow=max(0,1-math.hypot((x-590)/650,(y-610)/800))
  p[x,y]=(int(32+124*t+66*glow),int(40+81*t+33*glow),int(58+50*t+8*glow))
d=ImageDraw.Draw(im)
d.ellipse((490,460,680,650),fill=(255,214,145))
for base,col,amp in [(810,(115,111,122),125),(980,(77,84,103),210),(1190,(43,57,75),240),(1470,(24,39,52),260)]:
 pts=[(0,h),(0,base)]+[(x,base+math.sin(x/110+base)*amp*.32+math.sin(x/67+base)*amp*.22-amp*math.exp(-((x-310-base%170)/220)**2)) for x in range(0,w+1,10)]+[(w,h)]
 d.polygon(pts,fill=col)
# Tiny climber on the ridge, plus distant birds.
d.ellipse((414,1060,435,1082),fill=(19,27,37));d.line([(425,1080),(420,1117),(410,1144)],fill=(19,27,37),width=11);d.line([(420,1114),(436,1143)],fill=(19,27,37),width=7);d.line([(421,1090),(441,1104),(450,1084)],fill=(19,27,37),width=6);d.line([(451,1085),(449,1149)],fill=(19,27,37),width=3)
for x,y in [(268,625),(300,650),(710,701)]:d.arc((x,y,x+16,y+10),180,330,fill=(40,43,52),width=2);d.arc((x+14,y,x+31,y+10),210,360,fill=(40,43,52),width=2)
# Light deterministic film texture.
for _ in range(80000):
 x=random.randrange(w);y=random.randrange(h);c=im.getpixel((x,y));delta=random.choice([-4,-2,2,4]);im.putpixel((x,y),tuple(max(0,min(255,v+delta)) for v in c))
im.save('public/demo/poster.jpg',quality=94)
