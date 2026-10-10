// A callout marked foldable opens and closes from its title, by click or by Enter and Space.
document.querySelectorAll(".callout.is-collapsible > .callout-title").forEach((title) => {
  const callout = title.parentElement;
  title.setAttribute("role", "button");
  title.tabIndex = 0;
  title.setAttribute("aria-expanded", String(!callout.classList.contains("is-collapsed")));
  const toggle = () => {
    const closed = callout.classList.toggle("is-collapsed");
    title.setAttribute("aria-expanded", String(!closed));
  };
  title.addEventListener("click", toggle);
  title.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
  });
});
