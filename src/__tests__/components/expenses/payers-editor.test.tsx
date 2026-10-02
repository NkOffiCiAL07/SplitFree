import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PayersEditor } from "@/components/expenses/payers-editor";
import type { PayerAmounts } from "@/lib/payers";

const members = [{ userId: "me", name: "Me Myself" }, { userId: "a", name: "Asha Rao" }, { userId: "b", name: "Bhanu Pal" }];

function Harness({ total = 300, startMultiple = false, startAmounts = {} as PayerAmounts, onState = vi.fn() }) {
  const [paidBy, setPaidBy] = useState("me");
  const [multiple, setMultiple] = useState(startMultiple);
  const [amounts, setAmounts] = useState<PayerAmounts>(startAmounts);
  onState({ paidBy, multiple, amounts });
  return (
    <PayersEditor
      members={members} currentUserId="me" total={total} currency="INR"
      paidById={paidBy} onPaidByChange={setPaidBy}
      multiple={multiple} onMultipleChange={setMultiple}
      amounts={amounts} onAmountsChange={setAmounts}
    />
  );
}

describe("PayersEditor", () => {
  it("single mode: shows one chip per member (You for the current user) and changes the payer", async () => {
    const onState = vi.fn();
    render(<Harness onState={onState} />);
    expect(screen.getByRole("button", { name: /you/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /asha/i }));
    expect(onState).toHaveBeenLastCalledWith(expect.objectContaining({ paidBy: "a" }));
  });

  it("switching to multiple payers pre-fills an even split that adds up", async () => {
    render(<Harness total={100} />);
    await userEvent.click(screen.getByRole("button", { name: /multiple payers/i }));
    expect(screen.getByLabelText(/paid by you/i)).toHaveValue(33.34);
    expect(screen.getByLabelText(/paid by asha/i)).toHaveValue(33.33);
    expect(screen.getByRole("status")).toHaveTextContent(/add up to the total/i);
  });

  it("tells you how much is still to assign, or how far over you are", async () => {
    render(<Harness total={300} startMultiple startAmounts={{ me: "200", a: "50" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("₹50.00 still to assign");
    const asha = screen.getByLabelText(/paid by asha/i);
    await userEvent.clear(asha);
    await userEvent.type(asha, "150");
    expect(screen.getByRole("status")).toHaveTextContent("₹50.00 over the total");
    await userEvent.clear(asha);
    await userEvent.type(asha, "100");
    expect(screen.getByRole("status")).toHaveTextContent(/add up to the total/i);
  });

  it("can go back to a single payer", async () => {
    render(<Harness startMultiple startAmounts={{ me: "150", a: "150" }} />);
    await userEvent.click(screen.getByRole("button", { name: /multiple payers/i }));
    expect(screen.queryByLabelText(/paid by/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /asha/i })).toBeInTheDocument();
  });
});
