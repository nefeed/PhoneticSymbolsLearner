type Props = { sound: "ae" | "ih" | "schwa" | "sh"; className?: string };

/** Drawn outlines keep the symbol centered and independent of device fonts. */
export default function PhonemeMark({ sound, className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 80 80"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {sound === "ae" ? (
        <>
          <path
            fill="currentColor"
            fillRule="evenodd"
            d="M36 27C32 21 25 21 19 25C11 30 9 43 13 51C16 58 23 60 29 57C32 56 34 53 37 50L40 57C42 59 46 56 45 53C43 49 42 46 43 40L46 26C46 23 42 21 39 23L36 27ZM34 36C34 33 30 30 27 30C20 30 16 38 18 45C19 49 23 51 27 49C31 47 34 41 34 36Z"
          />
          <path
            fill="currentColor"
            fillRule="evenodd"
            d="M40 40C40 30 48 22 59 23C68 24 72 33 66 41C63 45 53 46 45 43C45 51 52 56 59 52C62 50 66 49 68 50C69 51 68 54 65 56C59 61 47 62 40 56C36 51 35 46 36 40H40ZM45 37C50 39 58 38 61 35C64 30 59 27 54 29C49 30 46 33 45 37Z"
          />
        </>
      ) : sound === "ih" ? (
        <path
          fill="currentColor"
          d="M29 23H51V28H44V52H51V57H29V52H36V28H29V23Z"
        />
      ) : sound === "schwa" ? (
        <path
          transform="rotate(180 40 40)"
          fill="currentColor"
          fillRule="evenodd"
          d="M58 42H29C30 49 35 53 41 53C46 53 50 51 53 46L58 50C54 56 48 59 41 59C30 59 23 51 23 40C23 29 30 21 40 21C50 21 58 27 58 38V42ZM29 37H52C51 31 47 27 40 27C34 27 30 30 29 37Z"
        />
      ) : (
        <path
          fill="currentColor"
          d="M47 17C54 17 58 20 59 24L53 27C52 24 50 23 47 23C43 23 41 27 41 34L40 49C40 59 36 64 29 64C24 64 20 62 18 57L24 54C25 57 27 58 29 58C33 58 34 55 34 48L35 33C35 22 39 17 47 17Z"
        />
      )}
    </svg>
  );
}
