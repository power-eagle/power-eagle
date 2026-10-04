import { useState, type CSSProperties } from 'react';
import { Badge } from './badge';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card';
import { Chip } from './chip';
import { Input } from './input';
import { IrisToggle } from './iris-toggle';
import { Panel } from './panel';
import { SectionLabel } from './section-label';
import { Separator } from './separator';
import { Switch } from './switch';
import { Tabs } from './tabs';

const colors = [
  ['background', 'var(--background)'], ['foreground', 'var(--foreground)'], ['card', 'var(--card)'],
  ['muted', 'var(--muted)'], ['accent', 'var(--accent)'], ['input', 'var(--input)'],
  ['primary', 'var(--primary)'], ['destructive', 'var(--destructive)'],
] as const;

export function DesignSystemGallery() {
  const [tab, setTab] = useState('preview');
  const [filter, setFilter] = useState('all');
  const [context, setContext] = useState(true);
  const [enabled, setEnabled] = useState(true);
  return <main className="pe-gallery pe-ground" aria-label="Power Eagle component gallery">
    <div className="pe-gallery-frame">
      <header className="pe-gallery-bar">
        <strong className="pe-wordmark pe-gallery-wordmark">power<span>eagle</span></strong>
        <span className="pe-gallery-status"><span className="pe-iris-dot pe-gallery-live" />design foundation · local fonts</span>
      </header>
      <div className="pe-gallery-panels">
        <Panel index="01" label="tokens" hint="protoflow">
          <div className="pe-gallery-section">
            <SectionLabel>color system</SectionLabel>
            <div>{colors.map(([name, value]) => <div
              key={name}
              className="pe-gallery-swatch"
              style={{ '--swatch': value } as CSSProperties}
            ><code>{name}</code></div>)}</div>
            <Separator decorative={false} />
            <p className="pe-small pe-gallery-note">Square frames, 4px spacing, one amber live signal.</p>
          </div>
        </Panel>

        <Panel index="02" label="controls" hint="production primitives">
          <div className="pe-gallery-section">
            <SectionLabel>actions</SectionLabel>
            <div className="pe-gallery-row">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Remove</Button>
            </div>
            <div className="pe-gallery-row">
              <Button size="sm" variant="secondary">Small</Button>
              <Button size="lg" variant="outline">Large</Button>
              <Button size="icon" variant="secondary" aria-label="Add item">+</Button>
            </div>
            <Separator />
            <SectionLabel>selection and input</SectionLabel>
            <Tabs aria-label="Gallery view" items={['preview', 'activation']} value={tab} onValueChange={setTab} />
            <div className="pe-gallery-row">
              {['all', 'visual', 'service'].map(value => <Chip key={value} active={filter === value} onClick={() => setFilter(value)}>{value}</Chip>)}
              <Chip variant="check" active={context} onClick={() => setContext(value => !value)}>Eagle API</Chip>
            </div>
            <Input aria-label="Package source" placeholder="owner/repo or name" />
            <Separator />
            <SectionLabel>contained content</SectionLabel>
            <Card>
              <CardHeader>
                <CardTitle>Compiled provider</CardTitle>
                <CardDescription>One artifact with runtime, widget, style, and service entries.</CardDescription>
              </CardHeader>
              <CardContent className="pe-gallery-row">
                <Badge variant="outline">widget</Badge>
                <Badge variant="outline">styling</Badge>
                <Badge>new</Badge>
              </CardContent>
              <CardFooter><Button size="sm" variant="secondary">Open package</Button></CardFooter>
            </Card>
          </div>
        </Panel>

        <Panel index="03" label="states" hint="active / off / failed">
          <div className="pe-gallery-section">
            <SectionLabel>activation</SectionLabel>
            <div className="pe-gallery-state">
              <IrisToggle name="Clipboard" on={enabled} onToggle={() => setEnabled(value => !value)} />
              <span className="pe-gallery-state-copy"><span className="pe-row-name">Clipboard</span><span className="pe-meta">service · used by 2</span></span>
              <span className="pe-meta">{enabled ? 'active' : 'off'}</span>
            </div>
            <div className="pe-gallery-state">
              <IrisToggle name="Greeter" on={false} failed />
              <span className="pe-gallery-state-copy"><span className="pe-row-name">Greeter</span><span className="pe-meta">missing dependency</span></span>
              <Badge variant="destructive">failed</Badge>
            </div>
            <div className="pe-gallery-state">
              <IrisToggle name="Recent Libraries" on={false} />
              <span className="pe-gallery-state-copy"><span className="pe-row-name">Recent Libraries</span><span className="pe-meta">visual · unused</span></span>
              <span className="pe-meta">off</span>
            </div>
            <Separator />
            <SectionLabel>preference</SectionLabel>
            <div className="pe-gallery-row"><Switch aria-label="Keep Agent context" checked={context} onCheckedChange={setContext} /><span className="pe-small">Keep Agent context</span></div>
            <p className="pe-small pe-gallery-note">IBM Plex Sans carries content. IBM Plex Mono carries chrome, ids, and counts.</p>
          </div>
        </Panel>
      </div>
    </div>
  </main>;
}
