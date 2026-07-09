export const formatPDFAmount = (num) => {
    if (num === null || num === undefined) return "0,00";
    const val = Number(num);
    if (isNaN(val)) return "0,00";
    return val.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};
