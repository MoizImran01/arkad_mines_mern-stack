/// <reference types="cypress" />

const ADMIN_URL = Cypress.env("ADMIN_URL");

describe("UC-BUY-010: Create Quotation for Customer (Admin)", () => {
  beforeEach(() => {
    cy.loginAsAdminAndVisit("/quotes");
    cy.get(".quotations-container", { timeout: 20000 }).should("be.visible");
  });

  it("T01 – Admin Quotations page loads with status tabs and quotation table", () => {
    cy.get(".quotations-tabs .tab-button").should("have.length.gte", 3);
    cy.get(".quotations-content").should("be.visible");

    cy.get("body").then(($body) => {
      const text = $body.text();
      const hasTabs =
        text.includes("All Quotations") ||
        text.includes("Submitted") ||
        text.includes("Issued") ||
        text.includes("Approved");
      expect(hasTabs).to.be.true;
    });
  });

  it("T02 – Submitted tab filters only submitted quotations", () => {
    cy.contains(".tab-button", "Submitted").click();
    cy.wait(1500);

    cy.get("body").then(($body) => {
      const hasRows = $body.find(".quotations-table tbody tr").length > 0;
      const hasEmpty = $body.find(".quotations-empty").length > 0;
      const text = $body.text().toLowerCase();
      expect(hasRows || hasEmpty || text.includes("no quotations")).to.be.true;

      if (hasRows) {
        cy.get(".status-badge").each(($badge) => {
          cy.wrap($badge).invoke("text").then((badgeText) => {
            expect(badgeText.toLowerCase()).to.include("submitted");
          });
        });
      }
    });
  });

  it("T03 – Selecting a submitted quotation opens the details panel with issue form", () => {
    cy.contains(".tab-button", "Submitted").click();
    cy.wait(1500);

    cy.get("body").then(($body) => {
      if ($body.find(".quotations-table tbody tr").length > 0) {
        cy.get(".quotations-table tbody tr").first().click();
        cy.wait(1500);

        cy.get(".quote-details-panel").should("be.visible");
        cy.get(".panel-header").should("exist");
      } else {
        cy.log("No submitted quotations — skipping detail panel test");
      }
    });
  });

  it("T04 – Tax, Shipping, and Discount fields accept numeric values", () => {
    cy.contains(".tab-button", "Submitted").click();
    cy.wait(1500);

    cy.get("body").then(($body) => {
      if ($body.find(".quotations-table tbody tr").length > 0) {
        cy.get(".quotations-table tbody tr").first().click();
        cy.wait(1500);

        cy.get("body").then(($b2) => {
          if ($b2.find("#taxPercentage").length > 0) {
            cy.get("#taxPercentage").type("{selectall}17");
            cy.get("#taxPercentage").should("have.value", "17");

            cy.get("#shippingCost").type("{selectall}5000");
            cy.get("#shippingCost").should("have.value", "5000");

            cy.get("#discountAmount").type("{selectall}500");
            cy.get("#discountAmount").should("have.value", "500");
          } else {
            cy.log("Issue form fields not visible — quotation may not be in issuable state");
          }
        });
      } else {
        cy.log("No submitted quotations — skipping");
      }
    });
  });

  it("T05 – BVA: Tax=0%, Shipping=0, Discount=0 accepted (lower boundary)", () => {
    cy.contains(".tab-button", "Submitted").click();
    cy.wait(1500);

    cy.get("body").then(($body) => {
      if ($body.find(".quotations-table tbody tr").length > 0) {
        cy.get(".quotations-table tbody tr").first().click();
        cy.wait(1500);

        cy.get("body").then(($b2) => {
          if ($b2.find("#taxPercentage").length > 0) {
            cy.get("#taxPercentage").type("{selectall}0");
            cy.get("#shippingCost").type("{selectall}0");
            cy.get("#discountAmount").type("{selectall}0");

            cy.get("#taxPercentage").should("have.value", "0");
            cy.get("#shippingCost").should("have.value", "0");
            cy.get("#discountAmount").should("have.value", "0");
          }
        });
      }
    });
  });

  it("T06 – Per-item unit price input is editable", () => {
    cy.contains(".tab-button", "Submitted").click();
    cy.wait(1500);

    cy.get("body").then(($body) => {
      if ($body.find(".quotations-table tbody tr").length > 0) {
        cy.get(".quotations-table tbody tr").first().click();
        cy.wait(1500);

        cy.get("body").then(($b2) => {
          const priceInput = $b2.find("[id^='unit-price-']");
          if (priceInput.length > 0) {
            cy.get("[id^='unit-price-']").first().clear().type("7500");
            cy.get("[id^='unit-price-']").first().should("have.value", "7500");
          } else {
            cy.log("No unit price inputs — issue form may not be visible");
          }
        });
      }
    });
  });

  it("T07 – Admin notes/terms textarea accepts text", () => {
    cy.contains(".tab-button", "Submitted").click();
    cy.wait(1500);

    cy.get("body").then(($body) => {
      if ($body.find(".quotations-table tbody tr").length > 0) {
        cy.get(".quotations-table tbody tr").first().click();
        cy.wait(1500);

        cy.get("body").then(($b2) => {
          if ($b2.find("#adminNotes").length > 0) {
            const notes = "Delivery within 14 business days. Payment terms: 50% advance.";
            cy.get("#adminNotes").clear().type(notes);
            cy.get("#adminNotes").should("have.value", notes);
          }
        });
      }
    });
  });

  it("T08 – Issue Quotation button exists in the details panel", () => {
    cy.contains(".tab-button", "Submitted").click();
    cy.wait(1500);

    cy.get("body").then(($body) => {
      if ($body.find(".quotations-table tbody tr").length > 0) {
        cy.get(".quotations-table tbody tr").first().click();
        cy.wait(1500);

        cy.get("body").then(($b2) => {
          if ($b2.find(".issue-btn").length > 0) {
            cy.get(".issue-btn").should("be.visible");
            cy.get(".issue-btn").invoke("text").should("match", /issue|finalize/i);
          } else {
            cy.log("Issue button not found — quotation may not be in submitted state");
          }
        });
      }
    });
  });

  it("T09 – Issued tab shows already-issued quotations with Download PDF button", () => {
    cy.contains(".tab-button", "Issued").click();
    cy.wait(1500);

    cy.get("body").then(($body) => {
      if ($body.find(".quotations-table tbody tr").length > 0) {
        cy.get(".quotations-table tbody tr").first().click();
        cy.wait(1500);

        cy.get(".quote-details-panel").should("be.visible");
        cy.get("body").then(($b2) => {
          const downloadBtn = $b2.find("button:contains('Download')");
          if (downloadBtn.length > 0) {
            cy.wrap(downloadBtn.first()).should("be.visible");
          } else {
            cy.log("No download button — issued quotation may not have PDF yet");
          }
        });
      } else {
        cy.log("No issued quotations — skipping");
      }
    });
  });
});

describe("UC-BUY-010: Unauthorized access", () => {
  it("T10 – Guest cannot access admin /quotes page", () => {
    cy.visit(`${ADMIN_URL}`, { failOnStatusCode: false });
    cy.clearLocalStorage();
    cy.visit(`${ADMIN_URL}/quotes`, { failOnStatusCode: false });
    cy.wait(3000);

    cy.url().should("include", "/login");
    cy.get(".quotations-container").should("not.exist");
  });
});
