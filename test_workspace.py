# The user claims `isExpenseExcludedFromMain` fails to re-evaluate when `contreExpert` changes.
# Actually, the problem might be that the component is doing a stale closure or memoization.
# Let's look at `mainExpenses` calculation in `Workspace.jsx`.
