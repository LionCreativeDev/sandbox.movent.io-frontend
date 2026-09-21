import { ReactNode } from 'react';
import { HiSparkles } from 'react-icons/hi2';
import { AI_THEME as T } from './theme';
import { serif } from './font';

export default function SectionHeader({ title, subtitle, right }: {
  title: string;
  subtitle: string;
  right?: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <HiSparkles size={17} color={T.gold} />
          <h2 className={serif.className} style={{ margin: 0, fontSize: 19, fontWeight: 700, color: T.heading }}>{title}</h2>
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: T.body }}>{subtitle}</p>
      </div>
      {right}
    </div>
  );
}
