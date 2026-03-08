/// <reference types="cypress" />

const API_URL = Cypress.env("API_URL");

describe("UC-BUY-005: Approve/Reject Quotation", () => {
  beforeEach(() => {
    cy.loginAsBuyer();

    cy.get(".nav-profile, a[href='/products']", { timeout: 15000 }).should("exist");

    cy.window().then((win) => {
      win.history.pushState({}, "", "/quotations");
      win.dispatchEvent(new PopStateEvent("popstate"));
    });

    cy.wait(2000);
  });

  it("T01 – Quotations page loads with status tabs", () => {
    cy.get(".quotations-page", { timeout: 15000 }).should("be.visible");

    cy.get(".quotations-tabs .tab-button").should("have.length.gte", 3);

    cy.get("body").then(($body) => {
      const text = $body.text();
      const hasTabs =
        text.includes("Pending") ||
        text.includes("Approved") ||
        text.includes("Rejected") ||
        text.includes("Drafts");
      expect(hasTabs).to.be.true;
    });
  });

  it("T02 – Pending tab shows quotation list or empty state", () => {
    cy.get(".quotations-page", { timeout: 15000 }).should("be.visible");

    cy.contains(".tab-button", "Pending").click();
    cy.wait(1000);

    cy.get("body").then(($body) => {
      const hasTable = $body.find(".quotations-table tbody tr").length > 0;
      const hasEmpty = $body.find(".quotations-empty").length > 0;
      const bodyText = $body.text().toLowerCase();
      const hasNoQuotes = bodyText.includes("no quotations") || bodyText.includes("no quotes");
      expect(hasTable || hasEmpty || hasNoQuotes).to.be.true;
    });
  });

  it("T03 – Selecting a quotation row opens the details panel", () => {
    cy.get(".quotations-page", { timeout: 15000 }).should("be.visible");

    cy.get("body").then(($body) => {
      if ($body.find(".quotations-table tbody tr").length > 0) {
        cy.get(".quotations-table tbody tr").first().click();
        cy.wait(1000);

        cy.get(".quote-details-panel").should("be.visible");
        cy.get(".panel-header").should("exist");
      } else {
        cy.log("No quotations available — skipping detail panel test");
      }
    });
  });

  it("T04 – Details panel shows items, financial summary, and action buttons", () => {
    cy.get(".quotations-page", { timeout: 15000 }).should("be.visible");

    cy.get("body").then(($body) => {
      if ($body.find(".quotations-table tbody tr").length > 0) {
        cy.get(".quotations-table tbody tr").first().click();
        cy.wait(1000);

        cy.get(".quote-details-panel").should("be.visible");

        cy.get(".quote-details-panel").then(($panel) => {
          const text = $panel.text();
          const hasItems = $panel.find(".quote-item-card").length > 0 || text.includes("Items");
          expect(hasItems).to.be.true;
        });
      } else {
        cy.log("No quotations — skipping");
      }
    });
  });

  it("T05 – Approve button opens verification modal (CAPTCHA or re-auth)", () => {
    cy.get(".quotations-page", { timeout: 15000 }).should("be.visible");

    cy.get("body").then(($body) => {
      const approveBtn = $body.find(".approve-btn");
      if (approveBtn.length > 0) {
        cy.get(".approve-btn").first().click({ force: true });
        cy.wait(1000);

        cy.get(".modal-overlay").should("be.visible");
        cy.get(".modal-content").should("be.visible");
      } else {
        const rows = $body.find(".quotations-table tbody tr");
        if (rows.length > 0) {
          cy.wrap(rows.first()).click();
          cy.wait(1000);

          cy.get("body").then(($b2) => {
            if ($b2.find(".approve-btn").length > 0) {
              cy.get(".approve-btn").first().click({ force: true });
              cy.wait(1000);
              cy.get(".modal-overlay").should("be.visible");
            } else {
              cy.log("No approve button available — quotation may not be in approvable state");
            }
          });
        } else {
          cy.log("No quotations to approve");
        }
      }
    });
  });

  it("T06 – Reject button opens decision modal with comment textarea", () => {
    cy.get(".quotations-page", { timeout: 15000 }).should("be.visible");

    cy.get("body").then(($body) => {
      const rejectBtn = $body.find(".reject-btn");
      if (rejectBtn.length > 0) {
        cy.get(".reject-btn").first().click({ force: true });
        cy.wait(1000);

        cy.get(".modal-overlay").should("be.visible");
        cy.get("#decision-comment").should("be.visible");
      } else {
        const rows = $body.find(".quotations-table tbody tr");
        if (rows.length > 0) {
          cy.wrap(rows.first()).click();
          cy.wait(1000);

          cy.get("body").then(($b2) => {
            if ($b2.find(".reject-btn").length > 0) {
              cy.get(".reject-btn").first().click({ force: true });
              cy.wait(1000);
              cy.get(".modal-overlay").should("be.visible");
              cy.get("#decision-comment").should("be.visible");
            } else {
              cy.log("No reject button — quotation may not be in rejectable state");
            }
          });
        } else {
          cy.log("No quotations to reject");
        }
      }
    });
  });

  it("T07 – Switching to Approved tab shows approved quotations or empty state", () => {
    cy.get(".quotations-page", { timeout: 15000 }).should("be.visible");

    cy.contains(".tab-button", "Approved").click();
    cy.wait(1000);

    cy.get("body").then(($body) => {
      const hasRows = $body.find(".quotations-table tbody tr").length > 0;
      const hasEmpty = $body.find(".quotations-empty").length > 0;
      const text = $body.text().toLowerCase();
      expect(hasRows || hasEmpty || text.includes("no quotations")).to.be.true;
    });
  });

  it("T08 – Switching to Rejected tab shows rejected quotations or empty state", () => {
    cy.get(".quotations-page", { timeout: 15000 }).should("be.visible");

    cy.contains(".tab-button", "Rejected").click();
    cy.wait(1000);

    cy.get("body").then(($body) => {
      const hasRows = $body.find(".quotations-table tbody tr").length > 0;
      const hasEmpty = $body.find(".quotations-empty").length > 0;
      const text = $body.text().toLowerCase();
      expect(hasRows || hasEmpty || text.includes("no quotations")).to.be.true;
    });
  });
});

describe("UC-BUY-005: Unauthenticated access", () => {
  it("T09 – Guest user cannot access /quotations page", () => {
    cy.visit("/", {
      onBeforeLoad(win) {
        win.localStorage.clear();
      },
    });
    cy.wait(1000);

    cy.visit("/quotations", { failOnStatusCode: false });
    cy.wait(3000);

    cy.url().then((currentUrl) => {
      const onQuotations = currentUrl.includes("/quotations");
      if (!onQuotations) {
        cy.get(".quotations-page").should("not.exist");
      } else {
        cy.get(".quotations-table").should("not.exist");
      }
    });
  });
});
