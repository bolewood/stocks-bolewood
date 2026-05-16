"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Home" },
    { href: "/vcx", label: "VCX" },
    { href: "/dxyz", label: "DXYZ" },
    { href: "/bot", label: "BOT" },
    { href: "/about", label: "About" },
  ];

  return (
    <header style={styles.header}>
      <div style={styles.inner}>
        <Link href="/" style={styles.brand}>
          <span style={styles.brandName}>stocks.bolewood.com</span>
        </Link>
        <nav style={styles.nav} className="site-header-nav">
          {links.map(({ href, label }) => {
            const isActive =
              href === "/"
                ? pathname === "/"
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                style={{
                  ...styles.link,
                  ...(isActive ? styles.linkActive : {}),
                }}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

const styles = {
  header: {
    borderBottom: "1px solid #e7e5e4",
    background: "#fefdf8",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  inner: {
    maxWidth: "1180px",
    margin: "0 auto",
    padding: "14px 56px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: {
    textDecoration: "none",
    color: "#1c1917",
  },
  brandName: {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "13px",
    fontWeight: 600,
    letterSpacing: "0.04em",
  },
  nav: {
    display: "flex",
    gap: "28px",
    alignItems: "center",
  },
  link: {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "12px",
    fontWeight: 500,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#78716c",
    textDecoration: "none",
    padding: "4px 0",
    transition: "color 0.15s ease",
  },
  linkActive: {
    color: "#d97706",
    borderBottom: "2px solid #d97706",
  },
};
