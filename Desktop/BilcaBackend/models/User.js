/* User.js */
const { Schema, model } = require("mongoose");

const userSchema = new Schema(
  {
    activeSessionId: { type: String, default: null },
    name: {
      type: String,
      required: [true, "El nombre es obligatorio"],
      trim: true,
      maxlength: [50, "Nombre muy largo"],
    },
    city: {
      type: String,
      required: [
        function () {
          return !this.googleId && !this.appleId;
        },
        "La ciudad de residencia es obligatoria",
      ],
      trim: true,
      maxlength: [50, "Nombre muy largo"],
    },
    phone: {
      type: String,
      required: [
        function () {
          return !this.googleId && !this.appleId;
        },
        "Debes ingresar un número de contacto",
      ],
      trim: true,
      maxlength: [50, "Número muy largo"],
    },
    country: {
      type: String,
      required: [
        function () {
          return !this.googleId && !this.appleId;
        },
        "El país de residencia es obligatorio",
      ],
      trim: true,
      maxlength: [50, "Nombre muy largo"],
    },
    birthday: {
      type: Date,
      required: [
        function () {
          return !this.googleId && !this.appleId;
        },
        "Debes ingresar tu fecha de nacimiento",
      ],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "El email es obligatorio"],
      unique: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Email inválido"],
    },
    password: {
      type: String,
      required: [
        function () {
          return !this.googleId && !this.appleId;
        },
        "La contraseña es obligatoria",
      ],
      minlength: [6, "La contraseña debe tener al menos 6 caracteres"],
      select: false,
    },
    role: {
      type: String,
      enum: ["user", "worker", "admin", "superadmin"],
      default: "user",
    },
    photo: {
      type: String,
      default: "/assets/default-avatar.png",
    },
    location: {
      type: {
        type: String,
        default: "Point",
      },
      coordinates: {
        type: [Number],
        default: [-74.0, 4.6],
      },
      address: String,
    },
    services: {
      type: [
        {
          profession: {
            type: String,
            enum: [
              "plomero", "electricista", "niñero", "albañil", "jardinero",
              "carpintero", "pintor", "limpieza", "paseador de perros",
              "cuidadores de adultos", "mudanzas", "gasista",
            ],
            required: true,
          },
          hourlyRate: { type: Number, min: 0 },
          bio: { type: String, maxlength: 300 },
          isActive: { type: Boolean, default: true },
        },
      ],
      validate: {
        validator: function (arr) {
          if (this.role !== "worker") return arr.length === 0;
          return arr.some(s => s.isActive !== false);
        },
        message: function () {
          if (this.role !== "worker") 
            return "Los usuarios no pueden tener servicios";
          return "Debes tener al menos un servicio activo";
        }
      },
    },
    emailNotifications: {
      type: Boolean,
      default: true,
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    passwordHistory: [
      {
        password: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    bio: {
      type: String,
      maxlength: 500,
    },
    hourlyRate: Number,
    totalJobs: {
      type: Number,
      default: 0,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviews: [{ type: Schema.Types.ObjectId, ref: "Review" }],

    lastSeen: {
      type: Date,
      default: Date.now,
    },

    // Campos para autenticación externa
    googleId: { type: String, unique: true, sparse: true },
    appleId: { type: String, unique: true, sparse: true },

    // Campos para recuperación de contraseña
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    subscriptionTier: {
      type: String,
      enum: ['none', 'professional', 'featured'],
      default: 'none'
    },

    profileCompleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Índice geoespacial
userSchema.index({ location: "2dsphere" });
module.exports = model("User", userSchema);
