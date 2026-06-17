import { create } from 'zustand';

// =============================================================================
// UI STORE
// =============================================================================
//
// NON-PERSISTED store for transient UI state.
// This state is reset when the app is closed or backgrounded.
// This is appropriate because:
// - Modal visibility, active filters, current tab are ephemeral
// - No data loss if cleared - user can re-navigate
// - No need to persist across app restarts
// =============================================================================

interface UIState {
  // Modal visibility
  isAddTransactionModalOpen: boolean;
  isAddAccountModalOpen: boolean;
  isAddPocketModalOpen: boolean;
  isTransferModalOpen: boolean;
  isConfirmIncomeModalOpen: boolean;
  isConfirmExpenseModalOpen: boolean;
  isAddDebtModalOpen: boolean;

  // Active filters for transaction list
  transactionFilters: {
    dateFrom: Date | null;
    dateTo: Date | null;
    accountId: string | null;
    categoryId: string | null;
    type: 'INCOME' | 'EXPENSE' | 'TRANSFER' | null;
  };

  // Current tab index (for bottom tabs)
  currentTabIndex: number;

  // Selected month/year for budget view
  selectedMonth: number;
  selectedYear: number;

  // Actions - Modals
  openAddTransactionModal: () => void;
  closeAddTransactionModal: () => void;
  openAddAccountModal: () => void;
  closeAddAccountModal: () => void;
  openAddPocketModal: () => void;
  closeAddPocketModal: () => void;
  openTransferModal: () => void;
  closeTransferModal: () => void;
  openConfirmIncomeModal: () => void;
  closeConfirmIncomeModal: () => void;
  openConfirmExpenseModal: () => void;
  closeConfirmExpenseModal: () => void;
  openAddDebtModal: () => void;
  closeAddDebtModal: () => void;
  closeAllModals: () => void;

  // Actions - Filters
  setTransactionFilters: (
    filters: Partial<UIState['transactionFilters']>
  ) => void;
  clearTransactionFilters: () => void;

  // Actions - Navigation
  setCurrentTabIndex: (index: number) => void;

  // Actions - Budget
  setSelectedMonth: (month: number, year: number) => void;
}

const defaultFilters: UIState['transactionFilters'] = {
  dateFrom: null,
  dateTo: null,
  accountId: null,
  categoryId: null,
  type: null,
};

export const useUIStore = create<UIState>()((set) => ({
  // Initial modal states
  isAddTransactionModalOpen: false,
  isAddAccountModalOpen: false,
  isAddPocketModalOpen: false,
  isTransferModalOpen: false,
  isConfirmIncomeModalOpen: false,
  isConfirmExpenseModalOpen: false,
  isAddDebtModalOpen: false,

  // Initial filters
  transactionFilters: defaultFilters,

  // Initial navigation
  currentTabIndex: 0,

  // Initial budget selection (current month)
  selectedMonth: new Date().getMonth() + 1,
  selectedYear: new Date().getFullYear(),

  // Modal actions
  openAddTransactionModal: () => set({ isAddTransactionModalOpen: true }),
  closeAddTransactionModal: () => set({ isAddTransactionModalOpen: false }),
  openAddAccountModal: () => set({ isAddAccountModalOpen: true }),
  closeAddAccountModal: () => set({ isAddAccountModalOpen: false }),
  openAddPocketModal: () => set({ isAddPocketModalOpen: true }),
  closeAddPocketModal: () => set({ isAddPocketModalOpen: false }),
  openTransferModal: () => set({ isTransferModalOpen: true }),
  closeTransferModal: () => set({ isTransferModalOpen: false }),
  openConfirmIncomeModal: () => set({ isConfirmIncomeModalOpen: true }),
  closeConfirmIncomeModal: () => set({ isConfirmIncomeModalOpen: false }),
  openConfirmExpenseModal: () => set({ isConfirmExpenseModalOpen: true }),
  closeConfirmExpenseModal: () => set({ isConfirmExpenseModalOpen: false }),
  openAddDebtModal: () => set({ isAddDebtModalOpen: true }),
  closeAddDebtModal: () => set({ isAddDebtModalOpen: false }),
  closeAllModals: () =>
    set({
      isAddTransactionModalOpen: false,
      isAddAccountModalOpen: false,
      isAddPocketModalOpen: false,
      isTransferModalOpen: false,
      isConfirmIncomeModalOpen: false,
      isConfirmExpenseModalOpen: false,
      isAddDebtModalOpen: false,
    }),

  // Filter actions
  setTransactionFilters: (filters) =>
    set((state) => ({
      transactionFilters: { ...state.transactionFilters, ...filters },
    })),
  clearTransactionFilters: () => set({ transactionFilters: defaultFilters }),

  // Navigation actions
  setCurrentTabIndex: (index) => set({ currentTabIndex: index }),

  // Budget actions
  setSelectedMonth: (month, year) =>
    set({ selectedMonth: month, selectedYear: year }),
}));
