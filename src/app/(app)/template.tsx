// A template remounts on every navigation, so each page's content rises in.
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="anim-page">{children}</div>;
}
