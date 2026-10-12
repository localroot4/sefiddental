"""Contrast table for every text-on-surface pair the design system uses.
Run: python3 design/tools/contrast.py  (prints Markdown; exits 1 on any failure)."""
import re, sys
def lum(h):
    h=h.lstrip('#'); r,g,b=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    f=lambda c: c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
    return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)
def ratio(a,b):
    la,lb=lum(a),lum(b); hi,lo=max(la,lb),min(la,lb); return (hi+0.05)/(lo+0.05)
css=open('design/tokens.css',encoding='utf-8').read()
MARK='\n[data-theme="dark"] {'
light=dict(re.findall(r'(--color-[a-z-]+):\s*(#[0-9A-Fa-f]{6})',css.split(MARK)[0]))
dark=dict(light); dark.update(dict(re.findall(r'(--color-[a-z-]+):\s*(#[0-9A-Fa-f]{6})',css.split(MARK)[1].split('@media (prefers-color-scheme')[0])))
# (text token, surface token, role, minimum)
pairs=[('--color-ink','--color-surface','body text',4.5),('--color-ink','--color-surface-raised','text on cards',4.5),('--color-ink','--color-surface-sunken','text on bands',4.5),
('--color-ink-muted','--color-surface','secondary text',4.5),('--color-ink-muted','--color-surface-raised','secondary on cards',4.5),('--color-ink-muted','--color-surface-sunken','secondary on bands',4.5),
('--color-ink-faint','--color-surface','captions and placeholders (large or non-essential)',3.0),
('--color-brand','--color-surface','links and brand text >= 16 px',4.5),('--color-brand','--color-surface-raised','links on cards',4.5),('--color-brand-strong','--color-surface','small brand text',4.5),
('--color-brand','--color-brand-soft','brand text on soft chip',4.5),('--color-ink','--color-brand-soft','ink on soft chip',4.5),
('--color-on-brand','--color-brand','label on primary button',4.5),
('--color-on-warm','--color-warm','label on warm highlight',4.5),('--color-ink','--color-warm-soft','ink on warm soft',4.5),
('--color-success','--color-surface','success text',4.5),('--color-danger','--color-surface','error text',4.5),('--color-warning','--color-surface','warning text',4.5),('--color-info','--color-surface','info text',4.5),
('#FFFFFF','--color-danger-fill','white on danger fill',4.5),('--color-on-fill','--color-info-fill','label on info fill',4.5),('--color-on-fill','--color-success-fill','label on success fill',4.5),('--color-on-fill','--color-warning-fill','label on warning fill',4.5),
('--color-line-strong','--color-surface','borders and icons (non-text, 3:1)',3.0),('--color-focus','--color-surface','focus ring (non-text, 3:1)',3.0)]
fail=0
print('| Pair | Role | Light | Dark | Min |'); print('|---|---|---|---|---|')
for t,s,role,mn in pairs:
    def val(theme):
        a=theme.get(t,t) if t.startswith('--') else t; b=theme.get(s,s) if s.startswith('--') else s; return ratio(a,b)
    rl,rd=val(light),val(dark)
    okl='OK' if rl>=mn else 'FAIL'; okd='OK' if rd>=mn else 'FAIL'
    if okl=='FAIL' or okd=='FAIL': fail+=1
    print(f'| {t} on {s} | {role} | {rl:.2f} {okl} | {rd:.2f} {okd} | {mn} |')
print(f'\n{fail} failing pairs'); sys.exit(1 if fail else 0)
