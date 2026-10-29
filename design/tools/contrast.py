"""Contrast table for every text-on-surface pair the design system uses.
Translucent layers over the home hero photo are composited over a black and a
white photo pixel; the table shows the lower ratio.
Run: python3 design/tools/contrast.py  (prints Markdown; exits 1 on any failure)."""
import re, sys
def lum(h):
    h=h.lstrip('#'); r,g,b=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    f=lambda c: c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
    return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)
def ratio(a,b):
    la,lb=lum(a),lum(b); hi,lo=max(la,lb),min(la,lb); return (hi+0.05)/(lo+0.05)
def over(c,alpha,under):
    """Hex of color c at alpha painted over the opaque color under (sRGB source-over, 8 bit)."""
    c,under=c.lstrip('#'),under.lstrip('#')
    return '#'+''.join('%02X'%round(alpha*int(c[i:i+2],16)+(1-alpha)*int(under[i:i+2],16)) for i in (0,2,4))
def worst_over_photo(text,layer,alpha):
    """Lower ratio of text on the layer over a black and over a white photo pixel.
    Luminance rises with every channel, so these two pixels bound every photo pixel.
    If the text luminance falls between the two bounds, some pixel matches it: ratio 1."""
    lo,hi=over(layer,alpha,'#000000'),over(layer,alpha,'#FFFFFF')
    if lum(lo)<=lum(text)<=lum(hi): return 1.0
    return min(ratio(text,lo),ratio(text,hi))
css=open('design/tokens.css',encoding='utf-8').read()
MARK='\n[data-theme="dark"] {'
light=dict(re.findall(r'(--color-[a-z-]+):\s*(#[0-9A-Fa-f]{6})',css.split(MARK)[0]))
dark=dict(light); dark.update(dict(re.findall(r'(--color-[a-z-]+):\s*(#[0-9A-Fa-f]{6})',css.split(MARK)[1].split('@media (prefers-color-scheme')[0])))
# (text token, surface token, role, minimum)
pairs=[('--color-ink','--color-surface','body text',4.5),('--color-ink','--color-surface-raised','text on cards',4.5),('--color-ink','--color-surface-sunken','text on bands',4.5),
('--color-ink-muted','--color-surface','secondary text',4.5),('--color-ink-muted','--color-surface-raised','secondary on cards',4.5),('--color-ink-muted','--color-surface-sunken','secondary on bands',4.5),
('--color-ink-faint','--color-surface','non-text: placeholder glyphs and dividers',3.0),
('--color-brand','--color-surface','links and brand text >= 16 px',4.5),('--color-brand','--color-surface-raised','links on cards',4.5),('--color-brand-strong','--color-surface','small brand text',4.5),
('--color-brand','--color-brand-soft','brand text on soft chip',4.5),('--color-ink','--color-brand-soft','ink on soft chip',4.5),
('--color-on-brand','--color-brand','label on primary button',4.5),
('--color-on-warm','--color-warm','label on warm highlight',4.5),('--color-ink','--color-warm-soft','ink on warm soft',4.5),
('--color-success','--color-surface','success text',4.5),('--color-danger','--color-surface','error text',4.5),('--color-warning','--color-surface','warning text',4.5),('--color-info','--color-surface','info text',4.5),
('#FFFFFF','--color-danger-fill','white on danger fill',4.5),('--color-on-fill','--color-info-fill','label on info fill',4.5),('--color-on-fill','--color-success-fill','label on success fill',4.5),('--color-on-fill','--color-warning-fill','label on warning fill',4.5),
('--color-line-strong','--color-surface','borders and icons (non-text, 3:1)',3.0),('--color-focus','--color-surface','focus ring (non-text, 3:1)',3.0),
('#FFFFFF','#C81E2E','white on danger-strong (danger button hover, both themes)',4.5),('#C81E2E','--color-surface','danger-strong button shape (non-text, 3:1)',3.0)]
# tinted alerts (src/components/ui/Alert.tsx): the fill mixed into surface-raised at this share; ink text, icon in the tone's text color
TINTS=[('info',.22),('success',.22),('warning',.22),('danger',.14)]  # copies of the color-mix shares in Alert.tsx: change both together
# placeholders and empty states (PLACEHOLDER_SURFACE in src/components/ui/Feedback.tsx): brand mixed into surface-raised at this share; caption in ink-muted, its prefix and the empty state's secondary button in brand
PLACEHOLDER=.14  # copy of the color-mix share in PLACEHOLDER_SURFACE: change both together
# home hero layers over the photo: (text token, layer token, alpha, layer name, role, minimum)
SCRIM_A,BAND_A=.88,.90  # copies of the color-mix alphas of .scrim and .trust (b.html; the app hero from phase 4) and of DESIGN.md 1.1 and 7: change all of them together
SCRIM=('--color-surface',SCRIM_A,f'hero scrim (surface {SCRIM_A:.0%})'); BAND=('--color-surface-raised',BAND_A,f'trust band (surface-raised {BAND_A:.0%})')
photo_pairs=[('--color-ink',*SCRIM,'hero headline',4.5),('--color-ink-muted',*SCRIM,'hero subtext',4.5),
('--color-brand-strong',*SCRIM,'secondary button label',4.5),('--color-brand',*SCRIM,'secondary button border (non-text, 3:1)',3.0),
('--color-ink',*BAND,'fact text',4.5),('--color-ink-muted',*BAND,'fact captions',4.5)]
fail=0
def row(label,role,rl,rd,mn):
    global fail
    okl='OK' if rl>=mn else 'FAIL'; okd='OK' if rd>=mn else 'FAIL'
    if okl=='FAIL' or okd=='FAIL': fail+=1
    print(f'| {label} | {role} | {rl:.2f} {okl} | {rd:.2f} {okd} | {mn} |')
print('| Pair | Role | Light | Dark | Min |'); print('|---|---|---|---|---|')
for t,s,role,mn in pairs:
    def val(theme):
        a=theme.get(t,t) if t.startswith('--') else t; b=theme.get(s,s) if s.startswith('--') else s; return ratio(a,b)
    row(f'{t} on {s}',role,val(light),val(dark),mn)
for tone,share in TINTS:
    tint=lambda theme: over(theme[f'--color-{tone}-fill'],share,theme['--color-surface-raised'])
    label=f'{tone} alert tint ({tint(light)} / {tint(dark)})'
    row(f'--color-ink on {label}','alert text',ratio(light['--color-ink'],tint(light)),ratio(dark['--color-ink'],tint(dark)),4.5)
    row(f'--color-{tone} on {label}','alert icon (non-text, 3:1)',ratio(light[f'--color-{tone}'],tint(light)),ratio(dark[f'--color-{tone}'],tint(dark)),3.0)
panel=lambda theme: over(theme['--color-brand'],PLACEHOLDER,theme['--color-surface-raised'])
for t,role,mn in (('--color-ink-muted','placeholder caption, empty-state sentence',4.5),('--color-brand-strong','caption prefix, empty-state button label',4.5),('--color-brand','empty-state button border (non-text, 3:1)',3.0)):
    row(f'{t} on placeholder panel ({panel(light)} / {panel(dark)})',role,ratio(light[t],panel(light)),ratio(dark[t],panel(dark)),mn)
for t,s,alpha,name,role,mn in photo_pairs:
    row(f'{t} on {name}',role,worst_over_photo(light[t],light[s],alpha),worst_over_photo(dark[t],dark[s],alpha),mn)
def min_alpha(theme):
    """Lowest whole-percent scrim alpha at which every scrim pair still passes."""
    scrim=[p for p in photo_pairs if p[1:4]==SCRIM]
    for pct in range(50,101):
        if all(worst_over_photo(theme[t],theme[s],pct/100)>=mn for t,s,_,_,_,mn in scrim): return pct
    return None
print(f'\nScrim alpha needed for every scrim pair: {min_alpha(light)}% light, {min_alpha(dark)}% dark (built: {SCRIM_A:.0%}).')
print(f'\n{fail} failing pairs'); sys.exit(1 if fail else 0)
