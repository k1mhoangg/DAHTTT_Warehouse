import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useAuthStore = create(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isAuthenticated: false,

            login: (userData, token) => {
                set({
                    user: userData,
                    token: token,
                    isAuthenticated: true,
                })
            },

            logout: () => {
                set({
                    user: null,
                    token: null,
                    isAuthenticated: false,
                })
            },

            updateUser: (userData) => {
                set((state) => ({
                    user: { ...state.user, ...userData },
                }))
            },

            // Helper to check if user has specific role
            hasRole: (role) => {
                const { user } = get()
                if (!user) return false

                // Check if user's role matches
                if (user.Role === role) return true

                // Quản lý has all permissions
                if (user.Role === 'Quản lý') return true

                return false
            },

            // Helper to check if user type
            isUserType: (type) => {
                const { user } = get()
                return user?.Type === type
            },
        }),
        {
            name: 'auth-storage',
        }
    )
)

export default useAuthStore
