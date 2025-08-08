import { Injectable } from '@angular/core';
import { supabase } from '../../lib/supabase';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class SupabaseAuthService {
  constructor(private router: Router) {}

  async register(email: string, password: string, username: string): Promise<any> {
    try {
      console.log('Registriere User mit Supabase...');
      
      // 1. User in Supabase Auth erstellen
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            username: username
          }
        }
      });

      if (error) {
        console.error('Supabase auth error:', error);
        throw error;
      }

      if (!data.user) {
        throw new Error('Kein User nach Registrierung erhalten');
      }

      console.log('User in Auth erstellt:', data.user.id);

      // 2. User-Profil in der Datenbank erstellen
      try {
        // Versuche RPC-Funktion zu verwenden
        const { data: rpcData, error: rpcError } = await supabase.rpc('register_user', {
          p_username: username,
          p_email: email,
          p_user_id: data.user.id
        });

        if (rpcError) {
          console.warn('RPC register_user fehlgeschlagen, versuche Alternative:', rpcError);
          
          // Fallback: Alternative RPC-Funktion
          const { data: altRpcData, error: altRpcError } = await supabase.rpc('register_user_profile_only', {
            p_username: username,
            p_email: email,
            p_user_id: data.user.id
          });

          if (altRpcError) {
            console.warn('Alternative RPC fehlgeschlagen, versuche direkten Insert:', altRpcError);
            
            // Fallback: Direkter Insert in users-Tabelle
            const { error: insertError } = await supabase
              .from('users')
              .insert({
                id: data.user.id,
                username: username,
                email: email,
                password_hash: 'supabase_auth',
                balance: 10000.00
              });

            if (insertError) {
              console.error('Direkter Insert fehlgeschlagen:', insertError);
              // User aus Auth löschen wenn Profil-Erstellung fehlschlägt
              await supabase.auth.admin.deleteUser(data.user.id);
              throw insertError;
            }
          }
        }
      } catch (profileError) {
        console.error('Fehler beim Erstellen des User-Profils:', profileError);
        // User aus Auth löschen wenn Profil-Erstellung fehlschlägt
        await supabase.auth.admin.deleteUser(data.user.id);
        throw profileError;
      }

      return {
        success: true,
        user: data.user,
        message: 'Registrierung erfolgreich'
      };

    } catch (error) {
      console.error('Registrierungsfehler:', error);
      return {
        success: false,
        error: error.message || 'Unbekannter Fehler bei der Registrierung'
      };
    }
  }

  async login(email: string, password: string): Promise<any> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) {
        console.error('Supabase auth error:', error);
        throw error;
      }

      return {
        success: true,
        user: data.user,
        session: data.session
      };

    } catch (error) {
      console.error('Login-Fehler:', error);
      return {
        success: false,
        error: error.message || 'Unbekannter Fehler beim Login'
      };
    }
  }

  async logout(): Promise<void> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout-Fehler:', error);
      }
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Logout-Fehler:', error);
    }
  }

  async getCurrentUser(): Promise<any> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        console.error('Fehler beim Abrufen des aktuellen Users:', error);
        return null;
      }
      return user;
    } catch (error) {
      console.error('Fehler beim Abrufen des aktuellen Users:', error);
      return null;
    }
  }

  async isLoggedIn(): Promise<boolean> {
    const user = await this.getCurrentUser();
    return !!user;
  }
} 