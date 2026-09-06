export function HandText({ text }: { text: string }) {
  return (
    <>
      {text.split(/([’'])/).map((part, index) =>
        part === "'" || part === "’" ? (
          <span key={index} className="tight-apos">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
