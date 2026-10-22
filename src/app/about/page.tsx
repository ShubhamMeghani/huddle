import Link from 'next/link';

export const metadata = { title: 'About · Huddle' };

export default function AboutPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6" data-testid="about">
      <h1 className="text-3xl font-black">About Huddle</h1>
      <p className="font-semibold">
        Huddle is a party-games app for friend groups: everyone plays on their own phone, the server keeps score, and a phone that drops out comes
        back to the same seat.
      </p>
      <h2 className="text-xl font-black">Credits</h2>
      <p data-testid="geonames-attribution">
        Atlas place data © <a className="font-bold underline" href="https://www.geonames.org/">GeoNames</a>, licensed under{' '}
        <a className="font-bold underline" href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Quiz questions, movie lists, words and
        prompts are original to this project.
      </p>
      <p>
        Source and issues: <a className="font-bold underline" href="https://github.com/ShubhamMeghani/huddle">github.com/ShubhamMeghani/huddle</a>
      </p>
      <div className="flex gap-4 font-bold">
        <Link href="/" className="underline">
          Home
        </Link>
        <Link href="/privacy" className="underline">
          Privacy
        </Link>
      </div>
    </main>
  );
}
