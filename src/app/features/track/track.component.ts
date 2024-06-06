import { Component } from '@angular/core';
import { MContainerComponent } from '../../m-framework/m-container/m-container.component';
import { MMapComponent } from '../../m-framework/m-map/m-map.component';
import { FirebaseService } from '../../services/firebase.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAhaComponent } from '../../m-framework/m-aha/m-aha.component';
import { MTableComponent } from '../../m-framework/m-table/m-table.component';
import { HttpClient } from '@angular/common/http';
import { getDatabase, ref, set, get, update, remove, push, child, onValue } from 'firebase/database';

//@ts-ignore
declare var google; // Forward Declaration 

class Location{
  timeStamp: string;
  lat: number;
  lon: number;
  constructor(lat: number, lon: number){
    this.lat = lat; this.lon = lon; 
    this.timeStamp = new Date().toUTCString();
  }
}
class Toast{
  message: string; 
  type: string;
  duration: number; 
  header: string; 
  ngIfControl: boolean; 
  constructor(message: string, type:string, header: string, duration:number)
  {
    this.message = message; 
    this.type = type; 
    this.header = header; 
    this.duration = duration; 
    this.ngIfControl = false;
  }
  show(){
    this.ngIfControl = true; 
    setTimeout(()=>{
       this.ngIfControl = false; 
     },this.duration);
     return this;
  }
}

@Component({
  selector: 'app-track',
  standalone: true,
  imports: [MContainerComponent,MMapComponent,FormsModule,CommonModule,MAhaComponent,MTableComponent],
  templateUrl: './track.component.html',
  styleUrl: './track.component.css'
})
export class TrackComponent {
  busNumber: number;
  lat: number; 
  lng: number;
  counter: number;
  myInt: any; 
  map: any;
  list: any[];
  addresses: any[];
  toast: any;
  busMarker: any;  
  //----------------------------------------------------------------
  constructor(private http: HttpClient, private firebaseService:FirebaseService){
    this.busNumber = 0; 
    this.lat = 0; 
    this.lng = 0; 
    this.counter = 0; 
    this.list = [];
    this.addresses = [];
    this.toast = new Toast("","","",100);
    
  }
  //----------------------------------------------------------------
  drawHomeLocation(){
    navigator.geolocation.getCurrentPosition((position)=>{
      this.lat = position.coords.latitude;
      this.lng = position.coords.longitude;
      const icon = {
        url: "https://cdn-icons-png.flaticon.com/512/5385/5385604.png",
        scaledSize: new google.maps.Size(50,50)
      }
      this.drawMarkerWithIcon(this.lat,this.lng,icon);
      this.drawCircle(this.lat,this.lng,100,false);
    })
  }
  //----------------------------------------------------------------
  drawBusLocation(){
    const icon = {
      url: "https://cdn-icons-png.flaticon.com/512/4287/4287661.png",
      scaledSize: new google.maps.Size(50,50)
    }
    onValue(ref(this.firebaseService.getFirebaseDatabase(), "/driverlocation"), (data) => {
      let lat = data.val().lat;
      let lon = data.val().lon; 
      let timeStamp = data.val().timeStamp;
      console.log(timeStamp)
      if(this.inFence(lat,lon,1000))
        this.toast = new Toast("Get Ready.","success","Info",5000).show();
      if(!this.busMarker) 
        this.busMarker = this.drawMarkerWithIcon(lat, lon, icon);
      else
        this.reDrawBusMarker(lat, lon);
    });
  }
  //----------------------------------------------------------------
  inFence(buslat:number,buslon:number, warningradius: number)
  { 
    let homeLat = this.lat;
    let homeLng = this.lng; 
    const distance = this.calculateDistance(homeLat, homeLng, buslat, buslon);
    return distance <= warningradius;
  }
  //----------------------------------------------------------------
  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371e3; // Radius of the Earth in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
  }
  //----------------------------------------------------------------
  drawMarker(latitude: number, longitude: number){
    const marker = new google.maps.Marker({
      map: this.map,
      position: {lat: latitude, lng: longitude},
    });
  }

  //----------------------------------------------------------------
  drawMarkerWithIcon(latitude: number, longitude: number, icon:any){
    return new google.maps.Marker({
      map: this.map,
      position: {lat: latitude, lng: longitude},
      icon: icon,
      zIndex: 9999999,
    });
  }
  //----------------------------------------------------------------
  reDrawBusMarker(latitude: number, longitude: number){
   this.busMarker.setPosition(new google.maps.LatLng(latitude,longitude));
  }
  //---------------------------------------------------------------- 
  drawCircle(latitude: number, longitude: number, radius: number, changable: boolean){
    const circle = new google.maps.Circle({
      map: this.map, 
      center: {lat: latitude, lng: longitude},
      radius: radius,
      editable: changable
    });
  }
  //----------------------------------------------------------------
  getMapInstance(map: any)
  {
    this.map = map;
    this.map.addListener("click", (event:any) => {
      let location = event.latLng;
      this.drawMarker(location.lat(),location.lng());
      this.list.push(new Location(location.lat(),location.lng()));
    });
  }
  //--------------------------------------------------------------
  async getRouteFromFirebase(){
    this.drawHomeLocation();
    this.drawBusLocation();
    let routes = [];
    routes = await this.firebaseService.readList("/routes");
    let routeFound = false; 
    routes.forEach(route => {
      if(route.busNumber == this.busNumber)
      {
        routeFound = true; 
        this.list = route.locations; 
        this.list.forEach(location=>{
          this.map.setCenter({lat:location.lat, lng:location.lon});
          this.drawMarker(location.lat,location.lon)
        });
        this.location2AddressTranslation();
      }
    });
    if(!routeFound)
      this.toast = new Toast("Route not found. Check the number.","error","Error",3000).show();

  }
  //--------------------------------------------------------------
  location2AddressTranslation(){
    this.list.forEach((location)=>{
      let url = "https://maps.googleapis.com/maps/api/geocode/json?latlng="+location.lat+","+location.lon+"&key=AIzaSyAvdbNyMkWpcMBKRwghEShYjD4lFFKKo68";
      this.http.get(url).subscribe((cityData: any)=>{
        let address = cityData.results[0].formatted_address;
        this.addresses.push(address);
      });
    });
  }
}
