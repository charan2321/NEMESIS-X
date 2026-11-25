import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

describe("NEMESIS-X frontend flow", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, "", "/login");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("validates malformed email and rejects a weak password", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("Email address"), "not-an-email");
    await user.type(screen.getByLabelText("Password"), "short");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address");

    await user.clear(screen.getByLabelText("Email address"));
    await user.type(screen.getByLabelText("Email address"), "operator@example.test");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("alert")).toHaveTextContent("at least 8 characters");
  });

  it("reports invalid login credentials without authenticating", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("Email address"), "operator@example.test");
    await user.type(screen.getByLabelText("Password"), "WrongPassword1!");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("doesn’t match our records");
    expect(localStorage.getItem("nemesis-auth")).toBeNull();
  });

  it("validates registration name, password strength, and duplicate email", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Create account" }));
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter your name");

    await user.type(screen.getByLabelText("Full name"), "Demo Operator");
    await user.type(screen.getByLabelText("Email address"), "new.operator@example.test");
    await user.type(screen.getByLabelText("Password"), "weakpassword");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByRole("alert")).toHaveTextContent("uppercase, lowercase, and a number");

    await user.clear(screen.getByLabelText("Email address"));
    await user.type(screen.getByLabelText("Email address"), "operator@example.test");
    await user.clear(screen.getByLabelText("Password"));
    await user.type(screen.getByLabelText("Password"), "DemoPass123!");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByRole("alert")).toHaveTextContent("already exists");
  });

  it("rejects unsupported upload extensions before starting progress", async () => {
    localStorage.setItem("nemesis-auth", "true");
    window.history.replaceState({}, "", "/");
    render(<App />);

    const file = new File(["not a video"], "notes.txt", { type: "text/plain" });
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } });

    expect(await screen.findByRole("alert")).toHaveTextContent("Unsupported format");
    expect(screen.queryByText("Uploading your footage")).not.toBeInTheDocument();

    const oversized = new File(["video"], "large.mp4", { type: "video/mp4" });
    Object.defineProperty(oversized, "size", { value: 500 * 1024 * 1024 + 1 });
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [oversized] } });
    expect(await screen.findByText("This video is larger than the 500 MB limit.")).toBeInTheDocument();
  });

  it("renders all processing stages for a job route", () => {
    localStorage.setItem("nemesis-auth", "true");
    window.history.replaceState({}, "", "/jobs/NX-2408");
    render(<App />);

    for (const stage of ["Sampling", "Tracking", "Memory", "Interactions", "Anomaly", "Reasoning"]) {
      expect(screen.getByText(stage)).toBeInTheDocument();
    }
  });

  it("closes a deep-linked event drawer and returns to the results route on Escape", async () => {
    const user = userEvent.setup();
    localStorage.setItem("nemesis-auth", "true");
    window.history.replaceState({}, "", "/jobs/NX-2408/events/EV-2048");
    render(<App />);

    expect(await screen.findByRole("dialog", { name: "Movement against flow" })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await waitFor(() => expect(window.location.pathname).toBe("/jobs/NX-2408/results"));
    expect(screen.queryByRole("dialog", { name: "Movement against flow" })).not.toBeInTheDocument();
  });
});
