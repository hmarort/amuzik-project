import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError, from } from 'rxjs';
import { tap, catchError, switchMap, map } from 'rxjs/operators';
import { UserRequest } from './requests/users.request';
import { Router } from '@angular/router';
import { 
  Auth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult,
  UserCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  browserPopupRedirectResolver,
  browserLocalPersistence,
  setPersistence
} from '@angular/fire/auth';
import { Platform } from '@ionic/angular/standalone';

export interface User {
  id: string;
  username: string;
  email?: string;
  nombre?: string;
  apellidos?: string;
  base64?: string;
  friends?: User[];
  provider?: string; // To indicate the authentication provider (normal, google, etc.)
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private tokenKey = 'auth_token';
  private userDataKey = 'userData';
  private rememberMeKey = 'rememberMe';
  private isAndroid: boolean;
  
  constructor(
    private userRequest: UserRequest,
    private router: Router,
    private auth: Auth,
    private platform: Platform
  ) {
    this.isAndroid = this.platform.is('android');
    this.loadUserFromStorage();
    
    // Set persistence to LOCAL by default to work across page reloads
    setPersistence(this.auth, browserLocalPersistence).catch(error => {
      console.error('Error setting auth persistence:', error);
    });
    
    // Check for redirect result (important for Android)
    if (this.isAndroid) {
      this.handleRedirectResult();
    }
  }
  
  /**
   * Handle redirect result for Android authentication flow
   */
  private handleRedirectResult(): void {
    getRedirectResult(this.auth).then((result) => {
      if (result && result.user) {
        this.processFirebaseUser(result);
      }
    }).catch(error => {
      console.error('Error getting redirect result:', error);
    });
  }
  
  /**
   * Load user from localStorage or sessionStorage
   */
  private loadUserFromStorage(): void {
    const userData = this.getStoredItem(this.userDataKey);
    if (userData) {
      try {
        const user = JSON.parse(userData);
        this.currentUserSubject.next(user);
      } catch (e) {
        console.error('Error parsing user data from storage', e);
        this.logout();
      }
    } else {
      // Check if there's a Firebase user and sync it
      const firebaseUser = this.auth.currentUser;
      if (firebaseUser) {
        this.syncFirebaseUser(firebaseUser);
      }
    }
  }
  
  /**
   * Process Firebase user after successful authentication
   */
  private processFirebaseUser(result: UserCredential): void {
    const firebaseUser = result.user;
    
    if (firebaseUser) {
      // Create a minimal user object
      const userData: User = {
        id: firebaseUser.uid,
        username: firebaseUser.email?.split('@')[0] || firebaseUser.displayName || firebaseUser.uid,
        email: firebaseUser.email || '',
        nombre: firebaseUser.displayName?.split(' ')[0] || 'Usuario',
        apellidos: firebaseUser.displayName?.split(' ').slice(1).join(' ') || 'Google',
        provider: 'google'
      };
      
      // Update our state and storage
      this.currentUserSubject.next(userData);
      this.storeItem(this.userDataKey, JSON.stringify(userData));
      
      // Get the ID token and store it
      firebaseUser.getIdToken().then(token => {
        this.storeItem(this.tokenKey, token);
      });
      
      // Try to register or update the user in your backend if needed
      this.syncUserWithBackend(userData, firebaseUser);
    }
  }
  
  /**
   * Sync Firebase user with backend
   */
  private syncUserWithBackend(userData: User, firebaseUser: any): void {
    // This method would call your backend API to register or update the user
    // For simplicity, we'll leave it as a placeholder that you can implement
    // based on your backend requirements
    
    // Example:
    // this.userRequest.syncGoogleUser(userData).subscribe({
    //   next: (response) => console.log('User synced with backend'),
    //   error: (error) => console.error('Error syncing user with backend', error)
    // });
  }
  
  /**
   * Synchronize current Firebase user state
   */
  private syncFirebaseUser(firebaseUser: any): void {
    if (firebaseUser) {
      const userData: User = {
        id: firebaseUser.uid,
        username: firebaseUser.email?.split('@')[0] || firebaseUser.displayName || firebaseUser.uid,
        email: firebaseUser.email || '',
        nombre: firebaseUser.displayName?.split(' ')[0] || 'Usuario',
        apellidos: firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
        provider: 'firebase'
      };
      
      this.currentUserSubject.next(userData);
      this.storeItem(this.userDataKey, JSON.stringify(userData));
    }
  }
  
  /**
   * Determine if localStorage or sessionStorage should be used
   * @returns true if localStorage should be used, false for sessionStorage
   */
  private useLocalStorage(): boolean {
    return localStorage.getItem(this.rememberMeKey) === 'true';
  }
  
  /**
   * Get an item from the appropriate storage
   * @param key The key of the item
   * @returns The stored value or null
   */
  private getStoredItem(key: string): string | null {
    return localStorage.getItem(key) || sessionStorage.getItem(key);
  }
  
  /**
   * Store an item in the appropriate storage (local or session)
   * @param key The key of the item
   * @param value The value to store
   */
  private storeItem(key: string, value: string): void {
    if (this.useLocalStorage()) {
      localStorage.setItem(key, value);
    } else {
      sessionStorage.setItem(key, value);
    }
  }
  
  /**
   * Get current user
   * @returns The authenticated user or null
   */
  public getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }
  
  /**
   * Get authentication token
   * @returns The stored token or null
   */
  public getToken(): string | null {
    return this.getStoredItem(this.tokenKey);
  }
  
  /**
   * Method to login
   * @param username Username
   * @param password Password
   * @returns Observable with the response
   */
  login(username: string, password: string): Observable<any> {
    return this.userRequest.login(username, password).pipe(
      tap(response => {
        if (response && response.message) {
          const userData = response.message;
          // Add provider to differentiate
          userData.provider = 'normal';
          this.currentUserSubject.next(userData);
          
          // Save in appropriate storage
          this.storeItem(this.userDataKey, JSON.stringify(userData));
          
          // If there's a token in the response, save it too
          if (response.token) {
            this.storeItem(this.tokenKey, response.token);
          }
        }
      }),
      catchError(error => {
        console.error('Error during login:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Method for Google login - supports both Web and Android
   */
  loginWithGoogle(): Observable<any> {
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    
    // Different flow for Android vs Web
    if (this.isAndroid) {
      // On Android, use redirect method
      return from(signInWithRedirect(this.auth, provider)).pipe(
        catchError(error => {
          console.error('Error with Google redirect auth:', error);
          return throwError(() => error);
        })
      );
    } else {
      // On Web, use popup with fallback to redirect
      return from(signInWithPopup(this.auth, provider, browserPopupRedirectResolver)).pipe(
        switchMap((result) => {
          this.processFirebaseUser(result);
          return from([result]);
        }),
        catchError(popupError => {
          console.warn('Popup failed, trying redirect method:', popupError);
          
          // Fallback to redirect method if popup fails
          return from(signInWithRedirect(this.auth, provider)).pipe(
            catchError(redirectError => {
              console.error('Error with both popup and redirect auth:', redirectError);
              return throwError(() => redirectError);
            })
          );
        })
      );
    }
  }
  
  /**
   * Method to register
   * @param userData Registration form data
   * @returns Observable with the response
   */
  register(userData: FormData): Observable<any> {
    return this.userRequest.register(userData).pipe(
      catchError(error => {
        console.error('Error during registration:', error);
        return throwError(() => error);
      })
    );
  }
  
  /**
   * Method to log out
   */
  logout(): void {
    // Clear stored data
    localStorage.removeItem(this.userDataKey);
    sessionStorage.removeItem(this.userDataKey);
    localStorage.removeItem(this.tokenKey);
    sessionStorage.removeItem(this.tokenKey);
    
    // Sign out from Firebase if authenticated
    if (this.auth.currentUser) {
      this.auth.signOut();
    }
    
    // Reset state
    this.currentUserSubject.next(null);
    
    // Redirect to login
    this.router.navigate(['/login']);
  }
  
  /**
   * Check if user is authenticated
   * @returns true if there is an authenticated user
   */
  isAuthenticated(): boolean {
    return !!this.currentUserSubject.value || !!this.auth.currentUser;
  }
  
  /**
   * Update user data
   * @param userData Update form data
   * @returns Observable with the response
   */
  updateUserData(userData: FormData): Observable<any> {
    return this.userRequest.updateUserData(userData).pipe(
      tap(response => {
        if (response && response.user) {
          // Keep current provider
          const currentUser = this.currentUserSubject.value;
          const provider = currentUser?.provider || 'normal';
          
          // Update user in state and storage
          const updatedUser = { ...currentUser, ...response.user, provider };
          this.currentUserSubject.next(updatedUser);
          
          // Save in appropriate storage
          if (this.getStoredItem(this.userDataKey)) {
            this.storeItem(this.userDataKey, JSON.stringify(updatedUser));
          }
        }
      }),
      catchError(error => {
        console.error('Error updating user data:', error);
        return throwError(() => error);
      })
    );
  }
  
  /**
   * Refresh current user data from database
   * @returns Observable with the response
   */
  refreshUserData(): Observable<any> {
    const currentUser = this.getCurrentUser();
    if (!currentUser || !currentUser.id) {
      return throwError(() => new Error('No current user or ID not available'));
    }
    
    return this.userRequest.getUserById(currentUser.id).pipe(
      tap(response => {
        if (response && response.message) {
          // Keep current provider
          const provider = currentUser.provider || 'normal';
          
          // Always use fresh data from server, including friends list
          const refreshedUser = { ...response.message, provider };
          
          // Update state and storage
          this.currentUserSubject.next(refreshedUser);
          
          if (this.getStoredItem(this.userDataKey)) {
            this.storeItem(this.userDataKey, JSON.stringify(refreshedUser));
          }
        }
      }),
      catchError(error => {
        console.error('Error refreshing user data:', error);
        return throwError(() => error);
      })
    );
  }
}