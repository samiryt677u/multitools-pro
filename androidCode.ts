import { ProjectFile } from './types';

export const androidProjectFiles: ProjectFile[] = [
  {
    name: 'AndroidManifest.xml',
    path: 'app/src/main/AndroidManifest.xml',
    language: 'xml',
    description: 'Defines app metadata, splash/main activities, push notification reception, and hardware/internet permissions.',
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools"
    package="com.mytoolshub.admin">

    <!-- Permissions required for WebView, pull-to-refresh, and connectivity checker -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
    
    <!-- Permissions required for high-fidelity features requested -->
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" /> <!-- Android 13+ -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" /> <!-- Android 13+ -->

    <!-- Hardware requirements declarations -->
    <uses-feature android:name="android.hardware.camera" android:required="false" />

    <application
        android:allowBackup="true"
        android:dataExtractionRules="@xml/data_extraction_rules"
        android:fullBackupContent="@xml/backup_rules"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.MyToolsHub.Splash"
        android:networkSecurityConfig="@xml/network_security_config"
        android:hardwareAccelerated="true"
        android:windowSoftInputMode="adjustResize"
        tools:targetApi="34">

        <!-- Splash Screen Activity: Launched first, displays animated name "Samir" -->
        <activity
            android:name=".SplashActivity"
            android:exported="true"
            android:theme="@style/Theme.MyToolsHub.Splash"
            android:screenOrientation="portrait"
            android:configChanges="orientation|screenSize|keyboardHidden">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Main WebView Activity: Displays website, handles back buttons, camera, file picker -->
        <activity
            android:name=".MainActivity"
            android:exported="false"
            android:theme="@style/Theme.MyToolsHub"
            android:screenOrientation="unspecified"
            android:launchMode="singleTask"
            android:configChanges="orientation|screenSize|keyboardHidden|smallestScreenSize">
        </activity>

        <!-- FileProvider required for secure Camera capturing inside raw WebView -->
        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="\${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>

        <!-- Firebase FirebaseMessagingService placeholder for push notifications -->
        <service
            android:name=".MyFirebaseMessagingService"
            android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>

    </application>
</manifest>`
  },
  {
    name: 'MainActivity.kt',
    path: 'app/src/main/java/com/mytoolshub/admin/MainActivity.kt',
    language: 'kotlin',
    description: 'The core WebView engine. Hosts pull-to-refresh, file upload dialog custom mapping, safe custom schema routing, download managers, and internet loss overlays.',
    content: `package com.mytoolshub.admin

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Parcelable
import android.provider.MediaStore
import android.view.View
import android.webkit.*
import android.widget.Button
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import java.io.File
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var progressBar: ProgressBar
    private lateinit var offlineLayout: View
    private lateinit var btnRetry: Button
    
    private val targetUrl = "https://mytoolshub.co.in/admin"
    
    // File upload variables for WebChromeClient
    private var messageFilePathCallback: ValueCallback<Array<Uri>>? = null
    private var cameraPhotoPath: String? = null
    
    // Connectivity Monitor
    private var connectivityManager: ConnectivityManager? = null
    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            runOnUiThread {
                hideOfflineLayout()
                if (webView.url == null) {
                    webView.loadUrl(targetUrl)
                }
            }
        }

        override fun onLost(network: Network) {
            runOnUiThread {
                showOfflineLayout()
            }
        }
    }

    // Permission and Activity Launch Launchers
    private val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            startCameraChooser()
        } else {
            Toast.makeText(this, "Camera permission denied. Direct photo capture is disabled.", Toast.LENGTH_LONG).show()
            startFileOnlyChooser()
        }
    }

    private val selectFileAndCameraLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val data = result.data
            var results: Array<Uri>? = null

            // If camera captured an image, use cameraPhotoPath
            if (data == null || data.data == null) {
                if (cameraPhotoPath != null) {
                    results = arrayOf(Uri.fromFile(File(cameraPhotoPath!!)))
                }
            } else {
                val dataString = data.dataString
                if (dataString != null) {
                    results = arrayOf(Uri.parse(dataString))
                }
            }
            messageFilePathCallback?.onReceiveValue(results)
        } else {
            messageFilePathCallback?.onReceiveValue(null)
        }
        messageFilePathCallback = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Initialize UI Elements
        webView = findViewById(R.id.webView)
        swipeRefresh = findViewById(R.id.swipeRefresh)
        progressBar = findViewById(R.id.progressBar)
        offlineLayout = findViewById(R.id.offlineLayout)
        btnRetry = findViewById(R.id.btnRetry)

        // Set up Refresh layout
        swipeRefresh.setColorSchemeResources(R.color.accent_primary, R.color.brand_primary)
        swipeRefresh.setOnRefreshListener {
            webView.reload()
        }

        // Configure Offline Screen Retry Button
        btnRetry.setOnClickListener {
            if (isNetworkAvailable()) {
                hideOfflineLayout()
                webView.loadUrl(webView.url ?: targetUrl)
            } else {
                Toast.makeText(this, "Direct offline reconnection failed. Please ensure Wifi or Mobile Data is ON.", Toast.LENGTH_SHORT).show()
                swipeRefresh.isRefreshing = false
            }
        }

        // Set up safe WebView properties
        configureWebViewSettings()

        // Configure custom WebView and WebChrome clients
        setupWebViewClients()

        // Set up secure cookie synchronization for persistent sessions
        CookieManager.getInstance().setAcceptCookie(true)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)
        }

        // Start connection checker
        registerNetworkMonitor()

        // Load the initial admin website URL
        if (isNetworkAvailable()) {
            webView.loadUrl(targetUrl)
        } else {
            showOfflineLayout()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebViewSettings() {
        val settings = webView.settings
        
        // Premium optimization configurations
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.setSupportMultipleWindows(false)
        settings.javaScriptCanOpenWindowsAutomatically = false
        
        // Performance optimizations
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.setSupportZoom(true)
        settings.builtInZoomControls = true
        settings.displayZoomControls = false
        
        // Enabling media access
        settings.mediaPlaybackRequiresUserGesture = false
        
        // Scrolling and Layout compatibility
        webView.isVerticalScrollBarEnabled = true
        webView.isHorizontalScrollBarEnabled = false
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
    }

    private fun setupWebViewClients() {
        // WebViewClient primarily manages navigation transitions
        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                progressBar.visibility = View.VISIBLE
                progressBar.progress = 15
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                progressBar.visibility = View.GONE
                swipeRefresh.isRefreshing = false
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                // Ignore safe asset failures (analytics etc), focus on actual application failures.
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    if (request?.isForMainFrame == true) {
                        showOfflineLayout()
                    }
                }
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                
                // Keep the same domain inside local view, handle dialers, emails, messaging protocols securely
                if (url.startsWith("https://mytoolshub.co.in")) {
                    return false // Let WebView load it
                }
                
                try {
                    // Route system intent actions (e.g., dial, maps, mail accounts, external browser routes)
                    if (url.startsWith("tel:") || url.startsWith("mailto:") || url.startsWith("whatsapp://") || url.startsWith("intent://") || url.startsWith("geo:")) {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                        startActivity(intent)
                        return true
                    }
                } catch (e: Exception) {
                    Toast.makeText(this@MainActivity, "Unable to resolve handler for: " + Uri.parse(url).scheme, Toast.LENGTH_SHORT).show()
                }

                // For external websites, use System Default Browser
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                startActivity(intent)
                return true
            }
        }

        // WebChromeClient manages file choose intents, javascript dialogs, progress bars
        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                super.onProgressChanged(view, newProgress)
                progressBar.progress = newProgress
                if (newProgress >= 100) {
                    progressBar.visibility = View.GONE
                    swipeRefresh.isRefreshing = false
                } else {
                    progressBar.visibility = View.VISIBLE
                }
            }

            // File selection for file uploads support (camera captures & documents picker combined)
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                if (messageFilePathCallback != null) {
                    messageFilePathCallback?.onReceiveValue(null)
                }
                messageFilePathCallback = filePathCallback

                // Prompt user to verify Camera Access for direct pictures
                if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                    cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                } else {
                    startCameraChooser()
                }
                return true
            }
        }

        // Setting up integrated Download Listener
        webView.setDownloadListener { url, userAgent, contentDisposition, mimetype, contentLength ->
            try {
                // Request WRITE permission if targeting older levels
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q && ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                    Toast.makeText(this, "Write storage permission required to save files.", Toast.LENGTH_SHORT).show()
                    return@setDownloadListener
                }

                val request = DownloadManager.Request(Uri.parse(url))
                request.setMimeType(mimetype)
                
                val cookies = CookieManager.getInstance().getCookie(url)
                request.addRequestHeader("cookie", cookies)
                request.addRequestHeader("User-Agent", userAgent)
                request.setDescription("Downloading file from MyToolsHub Admin...")
                
                val filename = URLUtil.guessFileName(url, contentDisposition, mimetype)
                request.setTitle(filename)
                
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename)
                
                val dm = getSystemService(DOWNLOAD_SERVICE) as DownloadManager
                dm.enqueue(request)
                Toast.makeText(applicationContext, "Starting Download: $filename", Toast.LENGTH_LONG).show()
            } catch (e: Exception) {
                Toast.makeText(applicationContext, "Download failed: \${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun startCameraChooser() {
        var takePictureIntent: Intent? = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
        if (takePictureIntent?.resolveActivity(packageManager) != null) {
            var photoFile: File? = null
            try {
                photoFile = createCapturedImageFile()
            } catch (ex: IOException) {
                // Error occurred while creating the File
            }
            if (photoFile != null) {
                cameraPhotoPath = photoFile.absolutePath
                val photoURI = FileProvider.getUriForFile(
                    this,
                    "\${packageName}.fileprovider",
                    photoFile
                )
                takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, photoURI)
            } else {
                takePictureIntent = null
            }
        }

        val contentSelectionIntent = Intent(Intent.ACTION_GET_CONTENT)
        contentSelectionIntent.addCategory(Intent.CATEGORY_OPENABLE)
        contentSelectionIntent.type = "*/*" // Allow all documents, upload widgets decide constraints.

        val intentArray: Array<Intent?> = takePictureIntent?.let { arrayOf(it) } ?: arrayOfNulls(0)
        val chooserIntent = Intent(Intent.ACTION_CHOOSER)
        chooserIntent.putExtra(Intent.EXTRA_INTENT, contentSelectionIntent)
        chooserIntent.putExtra(Intent.EXTRA_TITLE, "Upload Document or Picture")
        chooserIntent.putExtra(Intent.EXTRA_INITIAL_INTENTS, intentArray)

        selectFileAndCameraLauncher.launch(chooserIntent)
    }

    private fun startFileOnlyChooser() {
        val contentSelectionIntent = Intent(Intent.ACTION_GET_CONTENT)
        contentSelectionIntent.addCategory(Intent.CATEGORY_OPENABLE)
        contentSelectionIntent.type = "*/*"
        
        val chooserIntent = Intent(Intent.ACTION_CHOOSER)
        chooserIntent.putExtra(Intent.EXTRA_INTENT, contentSelectionIntent)
        chooserIntent.putExtra(Intent.EXTRA_TITLE, "Select Document")
        
        selectFileAndCameraLauncher.launch(chooserIntent)
    }

    @Throws(IOException::class)
    private fun createCapturedImageFile(): File {
        val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val imageFileName = "IMG_\${timeStamp}_"
        val storageDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES)
        return File.createTempFile(imageFileName, ".jpg", storageDir)
    }

    // Handle back button clicks cleanly to support local web browsing history
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            AlertDialog.Builder(this)
                .setTitle("Exit App")
                .setMessage("Are you sure you want to close MyToolsHub Admin?")
                .setPositiveButton("Exit") { _, _ -> super.onBackPressed() }
                .setNegativeButton("Cancel", null)
                .show()
        }
    }

    // Active connection checker
    private fun isNetworkAvailable(): Boolean {
        val connectivity = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val activeNetwork = connectivity.activeNetwork ?: return false
        val capabilities = connectivity.getNetworkCapabilities(activeNetwork) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun registerNetworkMonitor() {
        connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val builder = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        connectivityManager?.registerNetworkCallback(builder.build(), networkCallback)
    }

    private fun showOfflineLayout() {
        offlineLayout.visibility = View.VISIBLE
        webView.visibility = View.GONE
        swipeRefresh.setEnabled(false)
        swipeRefresh.isRefreshing = false
    }

    private fun hideOfflineLayout() {
        offlineLayout.visibility = View.GONE
        webView.visibility = View.VISIBLE
        swipeRefresh.setEnabled(true)
    }

    override fun onDestroy() {
        super.onDestroy()
        connectivityManager?.unregisterNetworkCallback(networkCallback)
    }
}`
  },
  {
    name: 'SplashActivity.kt',
    path: 'app/src/main/java/com/mytoolshub/admin/SplashActivity.kt',
    language: 'kotlin',
    description: 'Handles high-fidelity animation loading curves. Fades and scales the stylized branding keyword "Samir", and smoothly boots our MainActivity after a 3.0-second delay.',
    content: `package com.mytoolshub.admin

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.animation.AnimationUtils
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class SplashActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_splash)

        // Make full screen and hide standard decoration bars
        window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LOW_PROFILE
        )

        val txtLogo: TextView = findViewById(R.id.txtSplashLogo)
        val progressBar: ProgressBar = findViewById(R.id.splashProgressBar)

        // Loading standard interpolation curves (Combine Fade-in and Zoom/Scale animation)
        val scaleAndFadeAnim = AnimationUtils.loadAnimation(this, R.anim.fade_in_zoom)
        txtLogo.startAnimation(scaleAndFadeAnim)

        // Custom incremental mock loading bar transition mapping alongside the 3 seconds delay
        val duration = 3000L
        val updateInterval = 50L
        val totalSteps = duration / updateInterval
        var currentStep = 0

        val handler = Handler(Looper.getMainLooper())
        
        val progressRunnable = object : Runnable {
            override fun run() {
                if (currentStep <= totalSteps) {
                    val progressRatio = (currentStep.toFloat() / totalSteps) * 100
                    progressBar.progress = progressRatio.toInt()
                    currentStep++
                    handler.postDelayed(this, updateInterval)
                }
            }
        }
        handler.post(progressRunnable)

        // Trigger MainActivity after exactly 3.00 seconds active timeout
        handler.postDelayed({
            // Launch main screen activity
            val intent = Intent(this@SplashActivity, MainActivity::class.java)
            startActivity(intent)
            
            // Finish Splash screen cleanly so user cannot press back button to enter splash again
            finish()
            
            // Apply elegant Crossfade transition
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
        }, duration)
    }
}`
  },
  {
    name: 'activity_splash.xml',
    path: 'app/src/main/res/layout/activity_splash.xml',
    language: 'xml',
    description: 'XML code specifying the deep-slate visual container layout, the "Samir" branding label, secondary text indicators, and the progress tracker bar.',
    content: `<?xml version="1.0" encoding="utf-8"?>
<androidx.constraintlayout.widget.ConstraintLayout xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    xmlns:tools="http://schemas.android.com/tools"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@color/splash_background"
    tools:context=".SplashActivity">

    <!-- Glowing Vector Atmosphere Radial background indicator -->
    <View
        android:id="@+id/glowBackground"
        android:layout_width="320dp"
        android:layout_height="320dp"
        android:background="@drawable/radial_gradient_glow"
        app:layout_constraintBottom_toTopOf="@+id/txtCreatorNote"
        app:layout_constraintEnd_toEndOf="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintTop_toTopOf="parent" />

    <!-- Centered stylized text logo branding "Samir" requested with Zoom-fade transitions -->
    <TextView
        android:id="@+id/txtSplashLogo"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Samir"
        android:textColor="@color/splash_text_color"
        android:textSize="48sp"
        android:textStyle="bold"
        android:fontFamily="sans-serif-condensed"
        android:letterSpacing="0.1"
        android:elevation="8dp"
        android:shadowColor="#42000000"
        android:shadowDx="2"
        android:shadowDy="2"
        android:shadowRadius="10"
        app:layout_constraintBottom_toBottomOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintTop_toTopOf="parent" />

    <!-- Subtitle mapping user branding structure -->
    <TextView
        android:id="@+id/txtSubtitle"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="8dp"
        android:text="MyToolsHub Secure Admin"
        android:textColor="@color/splash_subtitle_color"
        android:textSize="14sp"
        android:letterSpacing="0.15"
        android:fontFamily="sans-serif-medium"
        app:layout_constraintEnd_toEndOf="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintTop_toBottomOf="@+id/txtSplashLogo" />

    <!-- Progress linear loader tracker bar transitioning to main dashboard -->
    <ProgressBar
        android:id="@+id/splashProgressBar"
        style="?android:attr/progressBarStyleHorizontal"
        android:layout_width="160dp"
        android:layout_height="6dp"
        android:layout_marginBottom="48dp"
        android:progressDrawable="@drawable/progress_bar_horizontal_style"
        android:progress="0"
        android:max="100"
        app:layout_constraintBottom_toBottomOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        app:layout_constraintStart_toStartOf="parent" />

    <TextView
        android:id="@+id/txtCreatorNote"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginBottom="24dp"
        android:text="PRODUCTION SECURE EDITION"
        android:textColor="@color/splash_subtitle_color"
        android:textSize="10sp"
        android:letterSpacing="0.2"
        app:layout_constraintBottom_toTopOf="@+id/splashProgressBar"
        app:layout_constraintEnd_toEndOf="parent"
        app:layout_constraintStart_toStartOf="parent" />

</androidx.constraintlayout.widget.ConstraintLayout>`
  },
  {
    name: 'activity_main.xml',
    path: 'app/src/main/res/layout/activity_main.xml',
    language: 'xml',
    description: 'XML layout for the main screen. Contains the top Progress loader bar, SwipeRefreshLayout wrapper, standard full WebView client, and the Offline overlay panel.',
    content: `<?xml version="1.0" encoding="utf-8"?>
<androidx.constraintlayout.widget.ConstraintLayout xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    xmlns:tools="http://schemas.android.com/tools"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="?android:colorBackground"
    tools:context=".MainActivity">

    <!-- Slim Horizontal progress indicator for page loading activities -->
    <ProgressBar
        android:id="@+id/progressBar"
        style="?android:attr/progressBarStyleHorizontal"
        android:layout_width="match_parent"
        android:layout_height="4dp"
        android:indeterminate="false"
        android:max="100"
        android:progressDrawable="@drawable/progress_bar_horizontal_style"
        android:visibility="gone"
        app:layout_endToEnd="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintTop_toTopOf="parent" />

    <!-- Pull to Refresh SwipeRefreshLayout Container -->
    <androidx.swiperefreshlayout.widget.SwipeRefreshLayout
        android:id="@+id/swipeRefresh"
        android:layout_width="match_parent"
        android:layout_height="0dp"
        app:layout_constraintBottom_toBottomOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintTop_toBottomOf="@+id/progressBar">

        <!-- Core WebView Client Instance -->
        <WebView
            android:id="@+id/webView"
            android:layout_width="match_parent"
            android:layout_height="match_parent" />

    </androidx.swiperefreshlayout.widget.SwipeRefreshLayout>

    <!-- NATIVE OFFLINE SCREEN COVER SCREEN (Displayed selectively on lost connections) -->
    <androidx.constraintlayout.widget.ConstraintLayout
        android:id="@+id/offlineLayout"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:background="?android:colorBackground"
        android:visibility="gone"
        tools:visibility="gone"
        app:layout_constraintBottom_toBottomOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintTop_toTopOf="parent">

        <LinearLayout
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:gravity="center"
            android:orientation="vertical"
            android:padding="32dp"
            app:layout_constraintBottom_toBottomOf="parent"
            app:layout_constraintEnd_toEndOf="parent"
            app:layout_constraintStart_toStartOf="parent"
            app:layout_constraintTop_toTopOf="parent">

            <!-- High Contrast WiFi Off Icon -->
            <ImageView
                android:id="@+id/imgOffline"
                android:layout_width="80dp"
                android:layout_height="80dp"
                android:src="@drawable/ic_wifi_off"
                app:tint="?attr/colorError" />

            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginTop="24dp"
                android:text="Offline Area Connection"
                android:textColor="?android:attr/textColorPrimary"
                android:textSize="20sp"
                android:textStyle="bold" />

            <TextView
                android:layout_width="260dp"
                android:layout_height="wrap_content"
                android:layout_marginTop="8dp"
                android:gravity="center"
                android:text="No internet connection detected on your device. Please review Wifi, Cellular configurations and try again."
                android:textColor="?android:attr/textColorSecondary"
                android:textSize="14sp" />

            <!-- Retry button to poll network access natively -->
            <Button
                android:id="@+id/btnRetry"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginTop="32dp"
                android:text="Retry Reconnection"
                android:backgroundTint="@color/accent_primary"
                android:textColor="@android:color/white"
                android:paddingStart="24dp"
                android:paddingEnd="24dp" />

        </LinearLayout>

    </androidx.constraintlayout.widget.ConstraintLayout>

</androidx.constraintlayout.widget.ConstraintLayout>`
  },
  {
    name: 'styles.xml',
    path: 'app/src/main/res/values/styles.xml',
    language: 'xml',
    description: 'Style guide resource definitions representing light and dark options, including native titlebar minimization properties.',
    content: `<resources>
    <!-- Base Application Theme configuration -->
    <style name="Theme.MyToolsHub" parent="Theme.Material3.DayNight.NoActionBar">
        <!-- Main colors styling -->
        <item name="colorPrimary">@color/brand_primary</item>
        <item name="colorSecondary">@color/brand_secondary</item>
        <item name="colorAccent">@color/accent_primary</item>
        <item name="android:statusBarColor">?attr/colorPrimary</item>
        <item name="android:navigationBarColor">?attr/colorPrimary</item>
        <item name="colorError">#EF4444</item>
    </style>

    <!-- Splash Screen Specific Theme -->
    <style name="Theme.MyToolsHub.Splash" parent="Theme.Material3.DayNight.NoActionBar">
        <item name="android:windowBackground">@color/splash_background</item>
        <item name="android:statusBarColor">@color/splash_background</item>
        <item name="android:navigationBarColor">@color/splash_background</item>
        <item name="android:windowTranslucentStatus">false</item>
        <item name="android:windowFullscreen">true</item>
    </style>
</resources>`
  },
  {
    name: 'colors.xml',
    path: 'app/src/main/res/values/colors.xml',
    language: 'xml',
    description: 'Sleek design system hex values for backgrounds, texts, and active blue and teal status alerts.',
    content: `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- Sleek High Contrast Branding Theme Colors -->
    <color name="brand_primary">#0F172A</color> <!-- Slate 900 -->
    <color name="brand_secondary">#1E293B</color> <!-- Slate 800 -->
    <color name="accent_primary">#3B82F6</color> <!-- Blue 500 -->
    <color name="accent_vibrant">#2563EB</color> <!-- Blue 600 -->
    
    <!-- Custom Splash screen color values -->
    <color name="splash_background">#090D16</color> <!-- Premium midnight background -->
    <color name="splash_text_color">#F8FAFC</color> <!-- White-slate -->
    <color name="splash_subtitle_color">#64748B</color> <!-- Cool-grey 500 -->
    <color name="splash_progress_bg">#1E293B</color>
</resources>`
  },
  {
    name: 'fade_in_zoom.xml',
    path: 'app/src/main/res/anim/fade_in_zoom.xml',
    language: 'xml',
    description: 'Slight zoom-scale scaling curves paired with fine alpha transparency timings requested for the Splash Activity branding.',
    content: `<?xml version="1.0" encoding="utf-8"?>
<set xmlns:android="http://schemas.android.com/apk/res/android"
    android:fillAfter="true"
    android:interpolator="@android:anim/decelerate_interpolator">

    <!-- Smooth Fade In over 1200ms -->
    <alpha
        android:fromAlpha="0.0"
        android:toAlpha="1.0"
        android:duration="1200" />

    <!-- Smooth Scaling (Zoom) in centering over 1500ms -->
    <scale
        android:fromXScale="0.6"
        android:toXScale="1.0"
        android:fromYScale="0.6"
        android:toYScale="1.0"
        android:pivotX="50%"
        android:pivotY="50%"
        android:duration="1500" />
</set>`
  },
  {
    name: 'network_security_config.xml',
    path: 'app/src/main/res/xml/network_security_config.xml',
    language: 'xml',
    description: 'Security rules configuration limiting Webview queries strictly to secure URLs like HTTPS while permitting safe debugging redirects.',
    content: `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="false">
        <!-- Direct production domain constraints -->
        <domain includeSubdomains="true">mytoolshub.co.in</domain>
        <!-- Firebase Messaging support domains -->
        <domain includeSubdomains="true">firebaseapp.com</domain>
        <domain includeSubdomains="true">googleapis.com</domain>
    </domain-config>
    
    <!-- Permitting local environment testing if required by developer -->
    <debug-overrides>
        <trust-anchors>
            <certificates src="user" />
        </trust-anchors>
    </debug-overrides>
</network-security-config>`
  },
  {
    name: 'file_paths.xml',
    path: 'app/src/main/res/xml/file_paths.xml',
    language: 'xml',
    description: 'Provider maps designating directory paths where Webview image outputs can be written into file streams.',
    content: `<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- Map to local temporary image captures directories -->
    <external-files-path
        name="captured_images"
        path="Pictures" />
</paths>`
  },
  {
    name: 'build.gradle.kts (App)',
    path: 'app/build.gradle.kts',
    language: 'gradle',
    description: 'Gradle manifest mapping library configurations, compilation targets, minSdk capabilities, and Firebase extensions support.',
    content: `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.mytoolshub.admin"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.mytoolshub.admin"
        minSdk = 26 // Android 8.0+ Oreo Compatibility mandated
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("debug") // Map your Release keystore key here
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        viewBinding = false
    }
}`
  },
  {
    name: 'settings.gradle.kts',
    path: 'settings.gradle.kts',
    language: 'gradle',
    description: 'Identifies the projects name and pulls Maven modules directories.',
    content: `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "MyToolsHub"
include(":app")`
  },
  {
    name: 'MyFirebaseMessagingService.kt',
    path: 'app/src/main/java/com/mytoolshub/admin/MyFirebaseMessagingService.kt',
    language: 'kotlin',
    description: 'Sets up background channels to display professional alert banners on user devices on command.',
    content: `package com.mytoolshub.admin

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class MyFirebaseMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        // Handle incoming notifications here
        remoteMessage.notification?.let {
            sendNotification(it.title ?: "System Update", it.body ?: "Details modified inside panel.")
        }
    }

    override fun onNewToken(token: String) {
        // Send registration token to your backend web hosting DB
    }

    private fun sendNotification(title: String, messageBody: String) {
        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )

        val channelId = "admin_notifications_channel"
        val defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        
        val notificationBuilder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(messageBody)
            .setAutoCancel(true)
            .setSound(defaultSoundUri)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Create notification channel for API 26+ (Android 8.0+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "MyToolsHub Admin System Announcements",
                NotificationManager.IMPORTANCE_HIGH
            )
            notificationManager.createNotificationChannel(channel)
        }

        notificationManager.notify(System.currentTimeMillis().toInt(), notificationBuilder.build())
    }
}`
  }
];
