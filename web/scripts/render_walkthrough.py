import argparse,json,subprocess,textwrap
from pathlib import Path
parser=argparse.ArgumentParser(description='Trim loading waits and add English captions to the actual deployed-app recording. Requires ffmpeg.');parser.add_argument('folder',type=Path);parser.add_argument('--reuse-clips',action='store_true');args=parser.parse_args();folder=args.folder.resolve();capture=json.loads((folder/'capture.json').read_text())
styles='''[Script Info]
ScriptType: v4.00+
PlayResX: 1440
PlayResY: 1080
WrapStyle: 2
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,DejaVu Sans,25,&H00FFFFFF,&H000000FF,&H00181818,&H00181818,0,0,0,0,100,100,0,0,1,0,0,2,55,55,24,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
'''
def stamp(seconds):
 cs=round(seconds*100);return f'{cs//360000}:{cs//6000%60:02}:{cs//100%60:02}.{cs%100:02}'
clips=[];cursor=0;events=[]
for i,scene in enumerate(capture['scenes']):
 start=max(scene['start'],scene['end']-scene.get('holdSeconds',19)-(0 if i==0 else 3));end=scene['end'];duration=end-start
 clip=folder/f'clip-{i:02}.mp4'
 if not args.reuse_clips:
  subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-xerror','-y','-i',capture['videoPath'],'-ss',str(start),'-t',str(duration),'-an','-c:v','libx264','-crf','20','-preset','ultrafast','-threads','2','-r','25',str(clip)],check=True)
 probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(clip)]))
 if abs(float(probe['format']['duration'])-duration)>.12:raise RuntimeError('Clip duration does not match the actual capture scene')
 clips.append(clip)
 title=scene['title'];caption=scene['caption'];text='{\\b1\\c&H00D9C79C&}'+title+'{\\b0\\c&H00FFFFFF&}\\N'+'\\N'.join(textwrap.wrap(caption,100))
 events.append(f'Dialogue: 0,{stamp(cursor)},{stamp(cursor+duration)},Caption,,0,0,0,,{text}\n');cursor+=duration
(folder/'captions.ass').write_text(styles+''.join(events));
(folder/'clips.txt').write_text(''.join("file '"+str(clip)+"'\n" for clip in clips))
cmd=['ffmpeg','-hide_banner','-loglevel','warning','-xerror','-y','-f','concat','-safe','0','-i',str(folder/'clips.txt'),'-vf',f'pad=1440:1080:0:0:color=0x141920,ass={folder}/captions.ass,format=yuv420p','-filter_threads','1','-c:v','libx264','-crf','23','-preset','fast','-threads','2','-movflags','+faststart',str(folder/'GapWitness-Demo.mp4')]
subprocess.run(cmd,check=True)
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(folder/'GapWitness-Demo.mp4')]))
if abs(float(probe['format']['duration'])-cursor)>.5:raise RuntimeError('Rendered duration differs from expected complete recording')
if not 180<=cursor<=300:raise RuntimeError('Submission demo must be 3–5 minutes')
print(json.dumps({'rendered':True,'seconds':cursor,'file':str(folder/'GapWitness-Demo.mp4')}))
