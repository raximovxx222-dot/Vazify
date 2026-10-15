package uz.vazify.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import java.util.Locale

private val VazifyNavy = Color(0xFF12213E)
private val VazifyTeal = Color(0xFF00BFA6)

private data class Vazifa(
    val id: String,
    val title: String,
    val category: String,
    val description: String,
    val reward: String,
    val time: String,
    val level: String,
    val searchTerms: String
)

private val sampleTasks = listOf(
    Vazifa(
        id = "audio",
        title = "O‘zbekcha audio matnini tekshirish",
        category = "AI va ma’lumot",
        description = "Audio yozuvdan olingan matnni o‘qing. Eshitilgan so‘zlar bilan matnni solishtirib, berilgan ko‘rsatmalar bo‘yicha xatolarni belgilang. Bu topshiriq faqat foydalanuvchi ruxsat bergan, maxfiy bo‘lmagan namunaviy audio bilan bajarilishi kerak.",
        reward = "8 000 so‘m",
        time = "10–15 daqiqa",
        level = "Boshlang‘ich",
        searchTerms = "transkripsiya til"
    ),
    Vazifa(
        id = "products",
        title = "Mahsulot ma’lumotlarini tartiblash",
        category = "Kontent",
        description = "Mahsulot nomi, narxi va qisqa tavsifini belgilangan formatdagi jadvalga kiriting. Ma’lumotlar faqat buyurtmachi taqdim etgan yoki foydalanishga ruxsat berilgan manbalardan olinadi.",
        reward = "15 000 so‘m",
        time = "20–30 daqiqa",
        level = "Boshlang‘ich",
        searchTerms = "internet do‘kon jadval excel katalog"
    ),
    Vazifa(
        id = "testing",
        title = "Mobil sahifani sinab ko‘rish",
        category = "Testlash",
        description = "Namuna veb-sahifani mobil qurilmada oching, ko‘rsatilgan amallarni bajaring va topilgan xatolarni tushuntiring. Hech qanday maxfiy ma’lumot kiritmang.",
        reward = "12 000 so‘m",
        time = "15–20 daqiqa",
        level = "O‘rta",
        searchTerms = "mobil ilova sayt test xato ux"
    ),
    Vazifa(
        id = "images",
        title = "Rasmlarni toifalarga ajratish",
        category = "AI va ma’lumot",
        description = "Har bir namunaviy rasmni ko‘rib chiqing va belgilangan toifalardan mosini tanlang. Tushunarsiz yoki noto‘g‘ri rasmni alohida belgilang.",
        reward = "6 000 so‘m",
        time = "10 daqiqa",
        level = "Boshlang‘ich",
        searchTerms = "rasm tasniflash yorliqlash sun’iy intellekt"
    ),
    Vazifa(
        id = "survey",
        title = "Mahsulot bo‘yicha fikr bildirish",
        category = "So‘rovnoma",
        description = "Namuna mahsulot haqidagi savollarga o‘z fikringiz asosida javob bering. Faqat halol javoblar qabul qilinishi va bir odamdan takroriy so‘rovlar qanday hisoblanishi buyurtmachi tomonidan oldindan belgilanishi kerak.",
        reward = "5 000 so‘m",
        time = "5–8 daqiqa",
        level = "Oson",
        searchTerms = "fikr bildirish tajriba"
    ),
    Vazifa(
        id = "text",
        title = "Qisqa matnni tahrirlash",
        category = "Kontent",
        description = "Qisqa matndagi imlo va tushunarlilik muammolarini belgilang. Asl ma’noni saqlang va o‘zgartirishlarni tushunarli qilib kiriting.",
        reward = "7 000 so‘m",
        time = "10–15 daqiqa",
        level = "Boshlang‘ich",
        searchTerms = "o‘zbekcha matn tahrir imlo tavsif tarjima"
    )
)

private val taskCategories = listOf("Barchasi", "AI va ma’lumot", "Kontent", "Testlash", "So‘rovnoma")

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(
                colorScheme = lightColorScheme(
                    primary = VazifyNavy,
                    secondary = VazifyTeal,
                    background = Color(0xFFF7F9FC),
                    surface = Color.White
                )
            ) {
                VazifyApp()
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun VazifyApp() {
    var searchQuery by rememberSaveable { mutableStateOf("") }
    var selectedCategory by rememberSaveable { mutableStateOf("Barchasi") }
    var selectedTask by remember { mutableStateOf<Vazifa?>(null) }
    val savedTaskIds = remember { mutableStateListOf<String>() }
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val normalizedQuery = searchQuery.trim().lowercase(Locale("uz", "UZ"))
    val visibleTasks = sampleTasks.filter { task ->
        val categoryMatches = selectedCategory == "Barchasi" || task.category == selectedCategory
        val queryMatches = normalizedQuery.isEmpty() ||
            "${task.title} ${task.category} ${task.description} ${task.searchTerms}"
                .lowercase(Locale("uz", "UZ"))
                .contains(normalizedQuery)
        categoryMatches && queryMatches
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Vazify",
                        color = VazifyNavy,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 24.sp
                    )
                },
                actions = {
                    Text(
                        text = "NAMUNA",
                        color = Color(0xFF997015),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(end = 16.dp)
                    )
                }
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = Color(0xFFF7F9FC)
    ) { contentPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(contentPadding)
                .padding(horizontal = 20.dp)
        ) {
            Text(
                text = "Vaqtingizni daromadga aylantiring.",
                color = VazifyNavy,
                fontSize = 28.sp,
                lineHeight = 34.sp,
                fontWeight = FontWeight.ExtraBold,
                modifier = Modifier.padding(top = 12.dp)
            )
            Text(
                text = "O‘zingizga mos kichik vazifalarni tanlang va yangi ko‘nikmalarni rivojlantiring.",
                color = Color(0xFF66738B),
                fontSize = 15.sp,
                lineHeight = 22.sp,
                modifier = Modifier.padding(top = 8.dp, bottom = 14.dp)
            )
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFFEAF8F5)),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = "Ko‘rsatilgan vazifalar va mukofotlar namuna, haqiqiy buyurtma yoki daromad emas.",
                    color = VazifyNavy,
                    fontSize = 12.sp,
                    lineHeight = 18.sp,
                    modifier = Modifier.padding(12.dp)
                )
            }
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                label = { Text("Vazifani qidiring") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 16.dp)
            )
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                taskCategories.forEach { category ->
                    FilterChip(
                        selected = selectedCategory == category,
                        onClick = { selectedCategory = category },
                        label = { Text(category) }
                    )
                }
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Vazifalar", color = VazifyNavy, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Text("${visibleTasks.size} ta namuna", color = Color(0xFF66738B), fontSize = 13.sp)
            }
            if (visibleTasks.isEmpty()) {
                Text(
                    text = "Mos vazifa topilmadi. Qidiruv yoki toifani o‘zgartirib ko‘ring.",
                    color = Color(0xFF66738B),
                    modifier = Modifier.padding(vertical = 24.dp)
                )
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                ) {
                    items(visibleTasks, key = { it.id }) { task ->
                        TaskCard(
                            task = task,
                            isSaved = task.id in savedTaskIds,
                            onSave = {
                                if (task.id in savedTaskIds) {
                                    savedTaskIds.remove(task.id)
                                    scope.launch {
                                        snackbarHostState.showSnackbar("Vazifa tanlanganlardan olib tashlandi.")
                                    }
                                } else {
                                    savedTaskIds.add(task.id)
                                    scope.launch {
                                        snackbarHostState.showSnackbar(
                                            "Vazifa ushbu qurilmada tanlanganlarga belgilandi (namuna)."
                                        )
                                    }
                                }
                            },
                            onOpen = { selectedTask = task }
                        )
                    }
                    item { Spacer(modifier = Modifier.height(8.dp)) }
                }
            }
        }
    }

    selectedTask?.let { task ->
        TaskDetailsDialog(
            task = task,
            onDismiss = { selectedTask = null },
            onStart = {
                selectedTask = null
                scope.launch {
                    snackbarHostState.showSnackbar(
                        "Vazifani boshlash uchun hisob va haqiqiy buyurtmalar moduli ulanishi kerak."
                    )
                }
            }
        )
    }
}

@Composable
private fun TaskCard(
    task: Vazifa,
    isSaved: Boolean,
    onSave: () -> Unit,
    onOpen: () -> Unit
) {
    Card(
        onClick = onOpen,
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(task.category, color = VazifyTeal, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                TextButton(onClick = onSave) {
                    Text(
                        text = if (isSaved) "♥" else "♡",
                        color = if (isSaved) Color(0xFFD85070) else VazifyNavy,
                        fontSize = 22.sp
                    )
                }
            }
            Text(
                text = task.title,
                color = VazifyNavy,
                fontSize = 18.sp,
                lineHeight = 24.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = task.description,
                color = Color(0xFF66738B),
                fontSize = 13.sp,
                lineHeight = 19.sp,
                maxLines = 2,
                modifier = Modifier.padding(top = 6.dp)
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(top = 12.dp)
            ) {
                Text(task.time, color = Color(0xFF66738B), fontSize = 12.sp)
                Spacer(modifier = Modifier.width(14.dp))
                Text(task.level, color = Color(0xFF66738B), fontSize = 12.sp)
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 14.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("Namuna mukofot", color = Color(0xFF8792A5), fontSize = 11.sp)
                    Text(task.reward, color = VazifyNavy, fontWeight = FontWeight.ExtraBold, fontSize = 18.sp)
                }
                TextButton(onClick = onOpen) {
                    Text("Ko‘rish →", color = VazifyNavy, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun TaskDetailsDialog(
    task: Vazifa,
    onDismiss: () -> Unit,
    onStart: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Column {
                Text(task.category, color = VazifyTeal, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Text(task.title, color = VazifyNavy, fontWeight = FontWeight.Bold)
            }
        },
        text = {
            Column {
                Text(task.description, color = Color(0xFF66738B), lineHeight = 21.sp)
                Spacer(modifier = Modifier.height(16.dp))
                Text("Namuna mukofot: ${task.reward}", color = VazifyNavy, fontWeight = FontWeight.Bold)
                Text("Taxminiy vaqt: ${task.time}", color = VazifyNavy)
                Text("Daraja: ${task.level}", color = VazifyNavy)
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = "Hozircha haqiqiy buyurtma, hisob yaratish va to‘lov tizimi ulanmagan.",
                    color = Color(0xFF66738B),
                    fontSize = 12.sp
                )
            }
        },
        confirmButton = {
            TextButton(onClick = onStart) {
                Text("Vazifani boshlash →", color = VazifyNavy, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Yopish")
            }
        }
    )
}
