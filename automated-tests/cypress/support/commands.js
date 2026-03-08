Cypress.Commands.add("loginAsBuyer", () => {
  const apiUrl = Cypress.env("API_URL");

  cy.request({
    method: "POST",
    url: `${apiUrl}/api/user/login`,
    body: {
      email: Cypress.env("BUYER_EMAIL"),
      password: Cypress.env("BUYER_PASSWORD"),
    },
    failOnStatusCode: false,
  }).then((resp) => {
    if (!resp.body.success) {
      throw new Error(
        `Buyer login failed: ${resp.body.message}. ` +
        `Check BUYER_EMAIL and BUYER_PASSWORD in cypress.config.js.`
      );
    }

    const { token } = resp.body;

    cy.visit("/", {
      onBeforeLoad(win) {
        win.localStorage.setItem("token", token);
      },
    });

    cy.wait(2000);
  });
});

Cypress.Commands.add("navigateToProducts", () => {
  cy.get('a[href="/products"]', { timeout: 10000 }).first().click();
  cy.get(".products-page", { timeout: 20000 }).should("be.visible");
  cy.get(".loading-state").should("not.exist");
});

Cypress.Commands.add("loginAsAdminAndVisit", (path) => {
  const apiUrl = Cypress.env("API_URL");
  const adminUrl = Cypress.env("ADMIN_URL");

  cy.request({
    method: "POST",
    url: `${apiUrl}/api/user/login`,
    body: {
      email: Cypress.env("ADMIN_EMAIL"),
      password: Cypress.env("ADMIN_PASSWORD"),
    },
    failOnStatusCode: false,
  }).then((resp) => {
    if (!resp.body.success) {
      throw new Error(
        `Admin login failed: ${resp.body.message}. ` +
        `Check ADMIN_EMAIL and ADMIN_PASSWORD in cypress.config.js.`
      );
    }

    if (resp.body.user.role !== "admin") {
      throw new Error(
        `ADMIN_EMAIL has role "${resp.body.user.role}", not "admin".`
      );
    }

    const { token, user } = resp.body;

    cy.visit(`${adminUrl}${path || "/"}`, {
      failOnStatusCode: false,
      onBeforeLoad(win) {
        win.localStorage.setItem("adminToken", token);
        win.localStorage.setItem("adminUserData", JSON.stringify(user));
      },
    });

    cy.contains("Loading", { timeout: 5000 }).should("not.exist");
  });
});
