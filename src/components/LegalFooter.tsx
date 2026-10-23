import Link from "next/link";

const links = [
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
  ["Refunds", "/refund"],
  ["Disclaimer", "/disclaimer"],
  ["Contact", "/contact"],
] as const;

export default function LegalFooter() {
  return (
    <nav aria-label="Legal and support" className="flex flex-wrap justify-center gap-x-4 gap-y-2">
      {links.map(([label, href]) => (
        <Link key={href} href={href} className="hover:text-[#ffda91]">
          {label}
        </Link>
      ))}
    </nav>
  );
}
