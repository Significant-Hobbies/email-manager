import { Link } from 'react-router-dom';

export function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-sm leading-7">
      <a href="/" className="text-xs text-gray-500 hover:underline">
        ← Kinetic
      </a>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mt-4 text-xs text-gray-500">Last updated: 2026-08-22.</p>

      <p className="mt-8">
        These terms apply when you use Kinetic, the local-first Gmail workspace operated under the
        Significant Hobbies name. By connecting a Google account or using Kinetic, you agree to
        these terms.
      </p>

      <h2 className="mt-8 text-base font-semibold">What Kinetic provides</h2>
      <p className="mt-2">
        Kinetic provides read-only Gmail search, sender analytics, subscription discovery, and
        filter suggestions. Features may change or be discontinued as the product develops.
      </p>

      <h2 className="mt-8 text-base font-semibold">Your account and data</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>You must have permission to connect the Google account you use with Kinetic.</li>
        <li>
          Kinetic requests read-only Gmail access. It cannot compose, send, delete, archive, or
          modify your messages through that permission.
        </li>
        <li>
          You can disconnect Kinetic at any time by revoking its access in your Google Account.
        </li>
      </ul>

      <h2 className="mt-8 text-base font-semibold">Acceptable use</h2>
      <p className="mt-2">
        Do not misuse Kinetic, attempt to bypass its security controls, interfere with the service,
        or use it to access an account or data you do not own or have permission to use.
      </p>

      <h2 className="mt-8 text-base font-semibold">Service availability</h2>
      <p className="mt-2">
        Kinetic is provided as available and may occasionally be unavailable or contain errors. Keep
        independent access to Gmail and review suggested actions before applying them.
      </p>

      <h2 className="mt-8 text-base font-semibold">Privacy</h2>
      <p className="mt-2">
        The{' '}
        <Link to="/privacy" className="underline">
          privacy policy
        </Link>{' '}
        explains how Kinetic accesses, uses, stores, and protects Google user data.
      </p>
    </main>
  );
}
