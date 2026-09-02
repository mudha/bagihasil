export interface UnitSelectState {
    vehicleType: string
    brand: string
    model: string
    year: string
    color: string
    investorId: string
    brandEnabled: boolean
}

export type UnitSelectAction =
    | { type: "vehicleType"; value: string; validBrands: readonly string[] }
    | { type: "brand"; value: string; validModels: readonly string[] }
    | { type: "model"; value: string }
    | { type: "year"; value: string }
    | { type: "color"; value: string }
    | { type: "investor"; value: string }
    | { type: "unrelatedField" }
    | { type: "previewImage" }

export function createUnitSelectState(): UnitSelectState {
    return {
        vehicleType: "",
        brand: "",
        model: "",
        year: "",
        color: "",
        investorId: "",
        brandEnabled: false,
    }
}

export function updateUnitSelectState(state: UnitSelectState, action: UnitSelectAction): UnitSelectState {
    switch (action.type) {
        case "vehicleType": {
            const vehicleTypeChanged = action.value !== state.vehicleType
            const brandStillValid = action.validBrands.includes(state.brand)
            return {
                ...state,
                vehicleType: action.value,
                brand: vehicleTypeChanged && !brandStillValid ? "" : state.brand,
                model: vehicleTypeChanged && !brandStillValid ? "" : state.model,
                brandEnabled: Boolean(action.value),
            }
        }
        case "brand":
            return {
                ...state,
                brand: action.value,
                model: action.value !== state.brand || !action.validModels.includes(state.model) ? "" : state.model,
            }
        case "model":
            return { ...state, model: action.value }
        case "year":
            return { ...state, year: action.value }
        case "color":
            return { ...state, color: action.value }
        case "investor":
            return { ...state, investorId: action.value }
        case "unrelatedField":
        case "previewImage":
            return state
    }
}
