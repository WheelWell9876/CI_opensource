// webapp/static/scripts/docs.js

document.addEventListener('DOMContentLoaded', function() {
  // Enable smooth scrolling for sidebar navigation links.
  const sidebarLinks = document.querySelectorAll('.docs-sidebar a');

  sidebarLinks.forEach(link => {
    link.addEventListener('click', function(event) {
      event.preventDefault();
      const targetId = this.getAttribute('href').substring(1);
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        window.scrollTo({
          top: targetElement.offsetTop - 20,
          behavior: 'smooth'
        });
      }
    });
  });

  // Optional: Add logic to highlight the active section in the sidebar.
});
