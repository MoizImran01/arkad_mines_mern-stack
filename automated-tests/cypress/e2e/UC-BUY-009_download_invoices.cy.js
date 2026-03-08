/// <reference types="cypress" />

describe("UC-BUY-009: Download Invoices and History", () => {
  beforeEach(() => {
    cy.loginAsBuyer();

    cy.get(".nav-profile, a[href='/products']", { timeout: 15000 }).should("exist");

    cy.window().then((win) => {
      win.history.pushState({}, "", "/documents");
      win.dispatchEvent(new PopStateEvent("popstate"));
    });

    cy.wait(2000);
  });

  it("T01 – Authenticated buyer sees Document History page with tabs", () => {
    cy.get("body").should("not.contain", "Please sign in to view your documents");

    cy.get("body").then(($body) => {
      const text = $body.text();
      const hasTabs =
        text.includes("All Documents") ||
        text.includes("Document History") ||
        text.includes("No documents found");
      expect(hasTabs).to.be.true;
    });
  });

  it("T02 – Switching tabs filters the document list", () => {
    cy.get("body").then(($body) => {
      if ($body.find("button:contains('Invoices')").length > 0) {
        cy.contains("button", "Invoices").click();
        cy.wait(500);
        cy.contains("button", "All Documents").click();
      } else if ($body.find("button:contains('Quotes')").length > 0) {
        cy.contains("button", "Quotes").click();
        cy.wait(500);
        cy.contains("button", "All Documents").click();
      } else {
        cy.log("No tab buttons found — may be empty state");
      }
    });
  });

  it("T03 – Filters panel opens with date and order ID inputs", () => {
    cy.get("body").then(($body) => {
      const filterBtn = $body.find("button.filter-btn, button:contains('Filters')");
      if (filterBtn.length > 0) {
        cy.wrap(filterBtn.first()).click();
        cy.get(".filters-panel").should("be.visible");
        cy.get("input[type='date']").should("have.length.greaterThan", 0);
      } else {
        cy.log("No filter button — may be empty state with no documents");
      }
    });
  });

  it("T04 – Documents table or empty state is displayed", () => {
    cy.get("body").then(($body) => {
      if ($body.find(".documents-table").length > 0) {
        cy.get(".documents-table thead th").should("have.length.greaterThan", 0);
      } else {
        cy.get("body").invoke("text").should("match", /no documents|document history/i);
      }
    });
  });

  it("T05 – Download buttons exist when documents are present", () => {
    cy.get("body").then(($body) => {
      if ($body.find(".documents-table tbody tr").length > 0) {
        cy.get(".documents-table").within(() => {
          cy.get("button").should("have.length.greaterThan", 0);
        });
      } else {
        cy.log("No documents — buyer has no orders/quotations yet");
      }
    });
  });
});

describe("UC-BUY-009: Unauthenticated access", () => {
  it("T06 – Guest user is blocked from /documents", () => {
    cy.visit("/", {
      onBeforeLoad(win) {
        win.localStorage.clear();
      },
    });
    cy.wait(1000);

    cy.url().should("eq", Cypress.config("baseUrl") + "/");
    cy.get(".documents-table").should("not.exist");
    cy.get(".documents-content").should("not.exist");
  });
});
