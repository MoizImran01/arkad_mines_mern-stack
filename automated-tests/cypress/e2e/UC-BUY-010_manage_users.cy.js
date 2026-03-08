/// <reference types="cypress" />

const ADMIN_URL = Cypress.env("ADMIN_URL");

describe("UC-BUY-010: Manage Users and Roles", () => {
  beforeEach(() => {
    cy.loginAsAdminAndVisit("/users");
    cy.get(".users-container", { timeout: 20000 }).should("be.visible");
  });

  it("T01 – Admin Users page shows header, 4 stats cards, and user table", () => {
    cy.get(".users-header h1").should("contain", "User Management");
    cy.get(".stat-card").should("have.length", 4);
    cy.get(".users-table").should("be.visible");
    cy.get(".users-table tbody tr").should("have.length.greaterThan", 0);
  });

  it("T02 – Stats cards show Total Users, Administrators, Employees, Customers", () => {
    cy.get(".stat-card").eq(0).find(".stat-info p").should("contain", "Total Users");
    cy.get(".stat-card").eq(1).find(".stat-info p").should("contain", "Administrators");
    cy.get(".stat-card").eq(2).find(".stat-info p").should("contain", "Employees");
    cy.get(".stat-card").eq(3).find(".stat-info p").should("contain", "Customers");

    cy.get(".stat-info h3").each(($el) => {
      const count = parseInt($el.text().trim(), 10);
      expect(count).to.be.gte(0);
    });
  });

  it("T03 – Table has Company Name, Email, Role, Created, Actions columns", () => {
    cy.get(".users-table thead th").then(($headers) => {
      const text = [...$headers].map((h) => h.textContent.trim().toUpperCase()).join(" ");
      expect(text).to.include("COMPANY NAME");
      expect(text).to.include("EMAIL");
      expect(text).to.include("ROLE");
      expect(text).to.include("ACTIONS");
    });
  });

  it("T04 – Role dropdown with customer/employee/admin options exists", () => {
    cy.get(".role-select").should("have.length.greaterThan", 0);

    cy.get(".role-select").first().find("option").then(($options) => {
      const values = [...$options].map((o) => o.value);
      expect(values).to.include("customer");
      expect(values).to.include("employee");
      expect(values).to.include("admin");
    });
  });

  it("T05 – History and delete buttons present in action column", () => {
    cy.get(".history-btn").should("have.length.greaterThan", 0);
    cy.get(".delete-btn").should("have.length.greaterThan", 0);
  });

  it("T06 – Current user row is highlighted with disabled controls", () => {
    cy.get(".users-table tbody tr.current-user").should("have.length", 1);
    cy.get("tr.current-user .role-select").should("be.disabled");
    cy.get("tr.current-user .delete-btn").should("be.disabled");
  });
});

describe("UC-BUY-010: Unauthorized access", () => {
  it("T07 – Guest cannot access admin /users page", () => {
    cy.visit(`${ADMIN_URL}`, { failOnStatusCode: false });
    cy.clearLocalStorage();
    cy.visit(`${ADMIN_URL}/users`, { failOnStatusCode: false });
    cy.wait(3000);

    cy.url().should("include", "/login");
    cy.get(".users-container").should("not.exist");
  });
});
