const MAX_CITY_LENGTH = 100

export function getLoginCity(request: Request): string | null {
    const encodedCity = request.headers.get("x-vercel-ip-city")

    if (!encodedCity) return null

    try {
        return decodeURIComponent(encodedCity).trim().slice(0, MAX_CITY_LENGTH) || null
    } catch {
        return encodedCity.trim().slice(0, MAX_CITY_LENGTH) || null
    }
}
