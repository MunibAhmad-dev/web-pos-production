import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-canvas text-center">
      <h1 className="text-3xl font-semibold text-ink">404</h1>
      <p className="text-sm text-muted-foreground">This page doesn&apos;t exist.</p>
      <Link to="/" className="mt-3 text-sm font-medium text-brand-blue">
        Back to dashboard
      </Link>
    </div>
  );
}
