import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { useGroups, useGroup, useFriendContacts, toast } = vi.hoisted(() => ({
  useGroups: vi.fn(), useGroup: vi.fn(), useFriendContacts: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "me", email: "me@x.com", user_metadata: { name: "Nishant Kumar" } } }) }));
vi.mock("@/hooks/use-groups", () => ({ useGroups: () => useGroups(), useGroup: (id: string) => useGroup(id) }));
vi.mock("@/hooks/use-friends", () => ({ useFriendContacts: () => useFriendContacts() }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock("sonner", () => ({ toast }));

import ImportPage from "@/app/(dashboard)/import/page";

const CSV = [
  "Date,Description,Category,Cost,Currency,Nishant Kumar,Asha Rao,Zed",
  "2026-01-05,Dinner,Dining out,900.00,INR,600.00,-300.00,-300.00",
  "2026-01-09,Settle all balances,Payment,300.00,INR,-300.00,300.00,0.00",
].join("\n");

const upload = async (csv = CSV, name = "splitwise.csv") =>
  userEvent.upload(screen.getByLabelText(/splitwise csv file/i), new File([csv], name, { type: "text/csv" }));

const toReview = async () => userEvent.click(await screen.findByRole("button", { name: /continue to review/i }));

beforeEach(() => {
  vi.clearAllMocks();
  useGroups.mockReturnValue({ data: [{ id: "g1", name: "Goa Trip" }] });
  useGroup.mockReturnValue({ data: undefined });
  useFriendContacts.mockReturnValue({ data: [{ friendId: "a", friend: { name: "Asha Rao" } }, { friendId: "b", friend: { name: "Bhanu" } }] });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ data: { imported: 1, settlements: 1, duplicates: 0, skipped: [], skippedCount: 0 } }) }));
});

describe("ImportPage", () => {
  it("starts with only the file picker", () => {
    render(<ImportPage />);
    expect(screen.getByText(/import from splitwise/i, { selector: "h2" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/destination/i)).not.toBeInTheDocument();
  });

  it("summarises the file and auto-matches people it is sure about", async () => {
    render(<ImportPage />);
    await upload();
    expect(await screen.findByTestId("import-summary")).toHaveTextContent("1 expense and 1 payment from 2026-01-05 to 2026-01-09");
    expect(screen.getByLabelText("Nishant Kumar")).toHaveValue("me"); // matched to me
    expect(screen.getByLabelText("Asha Rao")).toHaveValue("a"); // matched to a friend by full name
    expect(screen.getByLabelText("Zed")).toHaveValue(""); // unknown — user must choose
  });

  it("blocks the import until every person is matched, and says who is missing", async () => {
    render(<ImportPage />);
    await upload();
    const button = await screen.findByRole("button", { name: /continue to review/i });
    expect(button).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Choose who Zed is");
    await userEvent.selectOptions(screen.getByLabelText("Zed"), "b");
    expect(button).toBeEnabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("sends the parsed rows and mapping, then shows the result", async () => {
    render(<ImportPage />);
    await upload();
    await userEvent.selectOptions(await screen.findByLabelText("Zed"), "b");
    await toReview();
    await userEvent.click(screen.getByRole("button", { name: /import 1 expense/i }));

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/import/splitwise");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.groupId).toBeNull();
    expect(body.mapping).toEqual({ "Nishant Kumar": "me", "Asha Rao": "a", Zed: "b" });
    expect(body.rows).toHaveLength(2);
    expect(body.rows[0]).toMatchObject({ description: "Dinner", cost: 90000, currency: "INR" });
    expect(await screen.findByTestId("import-result")).toHaveTextContent("Imported 1 expense and 1 payment");
  });

  it("imports into a chosen group using that group's members for matching", async () => {
    useGroup.mockImplementation((id: string) => ({
      data: id === "g1" ? { members: [{ userId: "me", user: { name: "Nishant Kumar" } }, { userId: "m2", user: { name: "Asha Rao" } }, { userId: "m3", user: { name: "Zed" } }] } : undefined,
    }));
    render(<ImportPage />);
    await upload();
    await userEvent.selectOptions(await screen.findByLabelText(/destination/i), "g1");
    await userEvent.click(screen.getByRole("button", { name: /re-match automatically/i }));
    expect(screen.getByLabelText("Asha Rao")).toHaveValue("m2");
    expect(screen.getByLabelText("Zed")).toHaveValue("m3");
    await toReview();
    await userEvent.click(screen.getByRole("button", { name: /import 1 expense/i }));
    expect(JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string).groupId).toBe("g1");
  });

  it("shows server errors and skipped rows", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ error: { message: "Everyone you map to must be a member of the group" } }) }));
    render(<ImportPage />);
    await upload();
    await userEvent.selectOptions(await screen.findByLabelText("Zed"), "b");
    await toReview();
    await userEvent.click(screen.getByRole("button", { name: /import 1 expense/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/must be a member/)));
    expect(screen.queryByTestId("import-result")).not.toBeInTheDocument();
  });

  it("rejects files that aren't Splitwise exports with a clear message", async () => {
    render(<ImportPage />);
    await upload("foo,bar\n1,2", "random.csv");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/doesn't look like a Splitwise export/)));
    expect(screen.queryByLabelText(/destination/i)).not.toBeInTheDocument();
  });

  it("is a guided flow: Upload → Match → Import, with the current step marked", async () => {
    render(<ImportPage />);
    const steps = () => screen.getAllByRole("listitem").filter((li) => ["Upload", "Match", "Import"].some((t) => li.textContent === t || li.textContent?.endsWith(t)));
    expect(steps().find((li) => li.getAttribute("aria-current") === "step")?.textContent).toMatch(/Upload/);
    await upload();
    await screen.findByLabelText("Zed");
    expect(steps().find((li) => li.getAttribute("aria-current") === "step")?.textContent).toMatch(/Match/);
    await userEvent.selectOptions(screen.getByLabelText("Zed"), "b");
    await toReview();
    expect(steps().find((li) => li.getAttribute("aria-current") === "step")?.textContent).toMatch(/Import/);
  });

  it("shows live how many people are matched", async () => {
    render(<ImportPage />);
    await upload();
    expect(await screen.findByText("2 of 3 matched")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Zed"), "b");
    expect(screen.getByText("3 of 3 matched")).toBeInTheDocument();
  });

  it("accepts a file dropped onto the drop zone", async () => {
    render(<ImportPage />);
    const zone = screen.getByText(/drop your csv here/i).closest("label")!;
    const file = new File([CSV], "dropped.csv", { type: "text/csv" });
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.dragOver(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    expect(await screen.findByTestId("import-summary")).toHaveTextContent("1 expense and 1 payment");
  });

  it("the review step recaps what is about to happen, and Back goes to matching without losing the choices", async () => {
    render(<ImportPage />);
    await upload();
    await userEvent.selectOptions(await screen.findByLabelText("Zed"), "b");
    await toReview();
    const review = screen.getByTestId("import-review");
    expect(review).toHaveTextContent("splitwise.csv");
    expect(review).toHaveTextContent("1 expense and 1 payment");
    expect(review).toHaveTextContent("between you and your friends");
    expect(review).toHaveTextContent("3 matched");
    expect(fetch).not.toHaveBeenCalled(); // nothing is saved until the button is pressed
    await userEvent.click(screen.getByRole("button", { name: /^back$/i }));
    expect(screen.getByLabelText("Zed")).toHaveValue("b");
  });

  it("celebrates with the counts, and 'Import another file' starts over", async () => {
    render(<ImportPage />);
    await upload();
    await userEvent.selectOptions(await screen.findByLabelText("Zed"), "b");
    await toReview();
    await userEvent.click(screen.getByRole("button", { name: /import 1 expense/i }));
    const done = await screen.findByTestId("import-result");
    expect(done).toHaveTextContent("Imported 1 expense and 1 payment");
    expect(within(done).getByRole("link", { name: /view expenses/i })).toHaveAttribute("href", "/expenses");
    expect(within(done).getByRole("link", { name: /who owes whom/i })).toHaveAttribute("href", "/settle");
    await userEvent.click(screen.getByRole("button", { name: /import another file/i }));
    expect(screen.getByText(/drop your csv here/i)).toBeInTheDocument();
    expect(screen.queryByTestId("import-result")).not.toBeInTheDocument();
  });
});
