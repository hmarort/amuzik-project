import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonAvatar,
  IonLabel,
  IonButtons,
  IonMenuButton,
  IonButton,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonInput,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonFab,
  IonFabButton,
  AlertController,
  IonMenuToggle,
  IonSearchbar,
  IonSpinner, IonRow, IonCol, IonGrid, IonText, IonListHeader, IonChip } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { menuOutline, personAdd, peopleOutline, trashOutline, chatbubbleOutline, searchOutline, addOutline } from 'ionicons/icons';
import { AuthService, User } from 'src/app/services/auth.service';
import { UserFacade } from '../../services/facades/users.facade';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-friends',
  templateUrl: './friends.page.html',
  styleUrls: ['./friends.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonAvatar,
    IonLabel,
    IonButtons,
    IonButton,
    IonIcon,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonInput,
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
    IonFab,
    IonFabButton,
    IonMenuToggle,
    IonSpinner],
})
export class FriendsPage implements OnInit {
  showAddFriendForm = false;
  friends: User[] = [];
  currentUser: User | null = null;
  searchUsername: string = '';
  isSearching: boolean = false;
  searchResults: User[] = [];
  isLoading: boolean = false;

  /**
   * Constructor de la clase
   * @param router 
   * @param alertController 
   * @param authService 
   * @param userFacade 
   */
  constructor(
    private router: Router,
    private alertController: AlertController,
    private authService: AuthService,
    private userFacade: UserFacade
  ) {
    addIcons({
      menuOutline,
      personAdd,
      peopleOutline,
      trashOutline,
      chatbubbleOutline,
      searchOutline,
      addOutline
    });
  }

  /**
   * Inicializa el componente FriendsPage.
   */
  ngOnInit() {
    // Cargar datos iniciales
    this.loadUserData();
    
    // Suscribirse a cambios en el usuario actual
    this.authService.currentUser$.subscribe((user: User | null) => {
      this.currentUser = user;
      if (user && user.friends) {
        this.friends = user.friends;
      } else {
        this.friends = [];
      }
    });
  }

  /**
   * Carga los datos del usuario actual y actualiza la lista de amigos.
   */
  loadUserData() {
    if (this.authService.isAuthenticated()) {
      this.isLoading = true;
      this.authService.refreshUserData()
        .pipe(
          finalize(() => this.isLoading = false)
        )
        .subscribe({
          next: () => {
            console.log('Datos del usuario actualizados correctamente');
          },
          error: (error) => {
            console.error('Error al cargar los datos del usuario:', error);
            this.presentAlert('Error', 'No se pudieron cargar los datos del usuario. Por favor, inténtalo de nuevo.');
          }
        });
    }
  }

  /**
   * Abre el formulario para añadir un nuevo amigo.
   * @param friendId 
   */
  openChat(friendId: string) {
    this.router.navigate(['/chat', friendId]);
  }

  /**
   * Deja de mostrar el formulario para añadir un nuevo amigo.
   */
  cancelAddFriend() {
    this.showAddFriendForm = false;
    this.resetSearch();
  }

  /**
   * Resetea el formulario de búsqueda y los resultados.
   */
  resetSearch() {
    this.searchUsername = '';
    this.searchResults = [];
    this.isSearching = false;
  }

  /**
   * Busca un usuario por su nombre de usuario.
   * @returns 
   */
  searchUser() {
    if (!this.searchUsername.trim()) {
      this.presentAlert('Error', 'Por favor, introduce un nombre de usuario para buscar');
      return;
    }
  
    this.isSearching = true;
    this.userFacade.getUserByUsername(this.searchUsername)
      .pipe(
        finalize(() => this.isSearching = false)
      )
      .subscribe({
        next: (response: any) => {
          console.log('Respuesta de búsqueda:', response);
          
          // Verificar si la respuesta contiene los datos del usuario en el formato esperado
          if (response && response.message) {
            const userData = response.message;
            
            // Verificar si el usuario ya es amigo
            const isAlreadyFriend = this.friends.some(friend => friend.id === userData.id);
            
            if (isAlreadyFriend) {
              this.presentAlert('Información', 'Este usuario ya está en tu lista de amigos');
            } else if (userData.id === this.currentUser?.id) {
              this.presentAlert('Información', 'No puedes añadirte a ti mismo como amigo');
            } else {
              // Convertir el resultado a un objeto de tipo User para la visualización
              const foundUser: User = {
                id: userData.id,
                username: userData.username,
                nombre: userData.nombre,
                apellidos: userData.apellidos,
                email: userData.email,
                base64: userData.base64
              };
              
              this.searchResults = [foundUser];
            }
          } else {
            this.presentAlert('No encontrado', 'No se encontró ningún usuario con ese nombre');
            this.searchResults = [];
          }
        },
        error: (error: any) => {
          console.error('Error al buscar usuario:', error);
          this.presentAlert('Error', 'Ocurrió un error al buscar el usuario. Por favor, inténtalo de nuevo.');
          this.searchResults = [];
        }
      });
  }

  /**
   * Añade un amigo a la lista de amigos del usuario actual.
   * @param user 
   * @returns 
   */
  addFriend(user: User) {
    if (!this.currentUser) {
      this.presentAlert('Error', 'No se pudo agregar el amigo. No se ha iniciado sesión.');
      return;
    }
    
    this.isLoading = true;
    this.userFacade.saveFriend(this.currentUser.id, user.id)
      .pipe(
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: (response: any) => {
          console.log('Respuesta al guardar amigo:', response);
          
          if (response && response.status === 'success') {
            // Refrescar los datos del usuario desde el servidor para obtener la lista actualizada de amigos
            this.isLoading = true;
            this.authService.refreshUserData()
              .pipe(
                finalize(() => {
                  this.isLoading = false;
                  this.showAddFriendForm = false;
                  this.resetSearch();
                })
              )
              .subscribe({
                next: () => {
                  this.presentAlert('Éxito', `${user.username} ha sido añadido a tu lista de amigos`);
                },
                error: (error: any) => {
                  console.error('Error al refrescar datos del usuario:', error);
                  this.presentAlert('Información', `Se ha enviado la solicitud de amistad, pero hubo un problema al actualizar la lista. Por favor, actualiza la página.`);
                }
              });
          } else {
            this.presentAlert('Error', 'No se pudo añadir el amigo. La respuesta del servidor no fue exitosa.');
          }
        },
        error: (error: any) => {
          console.error('Error al guardar amigo:', error);
          this.presentAlert('Error', 'Ocurrió un error al añadir el amigo. Por favor, inténtalo de nuevo.');
        }
      });
  }

  /**
   * Elimina un amigo de la lista de amigos del usuario actual.
   * @param friend 
   */
  async removeFriend(friend: User) {
    const alert = await this.alertController.create({
      header: 'Eliminar amigo',
      message: `¿Estás seguro de que quieres eliminar a ${friend.username} de tu lista de amigos?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Eliminar',
          handler: () => {
            if (!this.currentUser || !this.currentUser.id || !friend.id) {
              this.presentAlert('Error', 'No se pudo encontrar la información del usuario.');
              return;
            }
  
            this.isLoading = true;
            this.userFacade.deleteFriend(this.currentUser.id, friend.id)
              .pipe(
                finalize(() => this.isLoading = false)
              )
              .subscribe({
                next: () => {
                  console.log('Amigo eliminado correctamente');
                  
                  // Refrescar los datos del usuario desde el servidor para obtener la lista actualizada de amigos
                  this.isLoading = true;
                  this.authService.refreshUserData()
                    .pipe(
                      finalize(() => this.isLoading = false)
                    )
                    .subscribe({
                      next: () => {
                        console.log('Datos del usuario actualizados después de eliminar amigo');
                        this.presentAlert('Éxito', `${friend.username} ha sido eliminado de tu lista de amigos`);
                      },
                      error: (error) => {
                        console.error('Error al refrescar datos del usuario:', error);
                        this.presentAlert('Información', 'Amigo eliminado, pero ocurrió un error al actualizar la lista. Por favor, actualiza la página.');
                      }
                    });
                },
                error: (error) => {
                  console.error('Error al eliminar amigo:', error);
                  this.presentAlert('Error', 'No se pudo eliminar el amigo. Por favor, inténtalo de nuevo.');
                }
              });
          }
        }
      ]
    });
  
    await alert.present();
  }

  /**
   * Muestra una alerta con un mensaje específico.
   * @param header 
   * @param message 
   */
  async presentAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK']
    });

    await alert.present();
  }
}