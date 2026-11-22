import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AdminComponent } from './admin/admin.component';
import { TeacherSetupComponent } from './teacher-setup/teacher-setup.component';
import { StudentViewComponent } from './student-view/student-view.component';
import { GraderViewComponent } from './grader-view/grader-view.component';

@NgModule({
  declarations: [
    AppComponent,
    AdminComponent,
    TeacherSetupComponent,
    StudentViewComponent,
    GraderViewComponent,
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    FormsModule,
    AppRoutingModule,
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
