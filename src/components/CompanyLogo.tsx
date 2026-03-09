"use client";

const AVATAR_COLORS = [
  '#e57373', '#f06292', '#ba68c8', '#7986cb',
  '#4fc3f7', '#4db6ac', '#81c784', '#dce775',
  '#ffb74d', '#ff8a65', '#a1887f', '#90a4ae',
];

function companyAvatar(company: string) {
  let hash = 0;
  for (let i = 0; i < company.length; i++) hash = company.charCodeAt(i) + ((hash << 5) - hash);
  const color = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  const initials = company
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
  const domain = company
    .toLowerCase()
    .replace(/\b(inc|llc|corp|ltd|co|company|technologies|technology|solutions|services|group|holdings|software|systems)\b/g, '')
    .replace(/[^a-z0-9]/g, '') + '.com';
  return { color, initials: initials || '?', domain };
}

const LOGO_TOKEN = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;

type Props = {
  company: string;
  size?: number;
  className?: string;
};

export default function CompanyLogo({ company, size = 36, className = 'lead-card-avatar' }: Props) {
  const av = companyAvatar(company);

  if (!LOGO_TOKEN) {
    return (
      <div className={className} style={{ background: av.color, width: size, height: size }} aria-hidden="true">
        {av.initials}
      </div>
    );
  }

  return (
    <div className={`${className} lead-card-avatar--logo`} style={{ width: size, height: size }} aria-hidden="true">
      <img
        src={`https://img.logo.dev/${av.domain}?token=${LOGO_TOKEN}&size=64`}
        alt=""
        width={size}
        height={size}
        style={{ borderRadius: 6, objectFit: 'contain' }}
        onError={e => {
          const img = e.currentTarget;
          img.style.display = 'none';
          const fallback = img.nextElementSibling as HTMLElement | null;
          if (fallback) fallback.style.display = 'flex';
        }}
      />
      <div className={className} style={{ background: av.color, display: 'none', width: size, height: size }}>
        {av.initials}
      </div>
    </div>
  );
}
